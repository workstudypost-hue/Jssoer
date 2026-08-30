import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../../rbac/rbac.service';
import { OtpService } from './otp.service';
import { RefreshTokenService } from '../refresh-token.service';
import { DeviceService } from '../device.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { OtpChannel } from '@prisma/client';
import { OAuthProfile } from '../strategies/google-oauth.strategy';

@Injectable()
export class PublicAuthService {
  constructor(
    private prisma: PrismaService,
    private rbac: RbacService,
    private otpService: OtpService,
    private refreshTokenService: RefreshTokenService,
    private deviceService: DeviceService,
  ) {}

  /**
   * الخطوة 1: بدء التسجيل الذاتي (طالب أو مدرب فقط - أبدًا موظف).
   * الحساب يُنشأ بحالة pending_verification ولا يُفعَّل حتى التحقق من OTP.
   */
  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('يجب إدخال بريد إلكتروني أو رقم هاتف');
    }
    if (dto.requestedRole !== 'student' && dto.requestedRole !== 'instructor') {
      throw new BadRequestException('الدور المطلوب غير متاح للتسجيل الذاتي');
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
    });
    if (existing) {
      throw new ConflictException('يوجد حساب مسجَّل مسبقًا بهذا البريد/الهاتف');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        registrationType: 'self_service',
        preferredLocale: dto.preferredLocale,
        status: 'pending_verification',
      },
    });

    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: dto.requestedRole } });
    await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    if (dto.requestedRole === 'instructor') {
      await this.prisma.instructorProfile.create({
        data: { userId: user.id, accountStatus: 'active_pending_approval' },
      });
    }

    const identifier = dto.email ?? dto.phone!;
    const channel: OtpChannel = dto.email ? 'email' : 'sms';
    await this.otpService.generateAndSend(identifier, channel, 'registration', user.id);

    return { userId: user.id, message: 'تم إرسال رمز التحقق', identifier };
  }

  /**
   * الخطوة 2: تأكيد OTP → تفعيل الحساب وإصدار الجلسة.
   */
  async verifyRegistrationOtp(
    identifier: string,
    code: string,
    deviceFingerprint?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.otpService.verify(identifier, code, 'registration');

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (!user) throw new BadRequestException('المستخدم غير موجود');

    const isEmail = identifier === user.email;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'active',
        emailVerifiedAt: isEmail ? new Date() : undefined,
        phoneVerifiedAt: !isEmail ? new Date() : undefined,
      },
    });

    return this.issueSession(user.id, deviceFingerprint, ipAddress, userAgent);
  }

  /**
   * تسجيل الدخول بكلمة المرور (طلاب/مدربون فقط - الموظفون لهم مسار منفصل).
   */
  async login(dto: LoginDto, deviceFingerprint?: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { phone: dto.identifier }], isStaff: false },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('الحساب غير مُفعَّل بعد - يُرجى إكمال التحقق');
    }

    return this.issueSession(user.id, deviceFingerprint, ipAddress, userAgent);
  }

  /**
   * معالجة نتيجة OAuth (بعد رجوع Google/Microsoft بنجاح):
   * - إن وُجد AuthProvider مرتبط مسبقًا بهذا providerUserId → دخول مباشر.
   * - وإلا: يُبحث عن مستخدم بنفس البريد. الربط التلقائي يحدث فقط إذا كان بريد
   *   المستخدم الموجود مُتحقَّقًا منه مسبقًا (email_verified_at) - هذا شرط أمان
   *   حرج: يمنع مهاجمًا من الاستيلاء على حساب بريد غير مُتحقَّق بانتحاله عبر OAuth.
   * - إن لم يوجد أي حساب مطابق: يُنشأ حساب جديد بدور 'student' افتراضيًا
   *   (لا تسجيل OAuth مباشر كمدرب - يجب تسجيل صريح ثم موافقة إدارية كالعادة).
   */
  async handleOAuthLogin(
    oauthProfile: OAuthProfile,
    deviceFingerprint?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!oauthProfile.email) {
      throw new BadRequestException('تعذَّر الحصول على بريد إلكتروني من حساب OAuth');
    }

    const existingProvider = await this.prisma.authProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider: oauthProfile.provider,
          providerUserId: oauthProfile.providerUserId,
        },
      },
      include: { user: true },
    });

    if (existingProvider) {
      if (existingProvider.user.status !== 'active') {
        throw new UnauthorizedException('الحساب غير مُفعَّل');
      }
      return this.issueSession(existingProvider.userId, deviceFingerprint, ipAddress, userAgent);
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: oauthProfile.email } });

    if (existingUser) {
      // شرط الربط الآمن: لا نربط تلقائيًا إلا إذا كان بريد الحساب الموجود مُتحقَّقًا منه فعلًا
      if (!existingUser.emailVerifiedAt) {
        throw new ConflictException(
          'يوجد حساب بنفس البريد لكنه غير مُتحقَّق منه بعد - يُرجى تسجيل الدخول بكلمة المرور وتأكيد البريد أولًا قبل ربط حساب OAuth',
        );
      }
      await this.prisma.authProvider.create({
        data: {
          userId: existingUser.id,
          provider: oauthProfile.provider,
          providerUserId: oauthProfile.providerUserId,
          providerEmail: oauthProfile.email,
        },
      });
      return this.issueSession(existingUser.id, deviceFingerprint, ipAddress, userAgent);
    }

    // لا حساب موجود إطلاقًا → إنشاء حساب طالب جديد (الدور الوحيد المتاح عبر OAuth مباشرة)
    const studentRole = await this.prisma.role.findUniqueOrThrow({ where: { name: 'student' } });
    const newUser = await this.prisma.user.create({
      data: {
        email: oauthProfile.email,
        registrationType: 'oauth',
        status: 'active',
        emailVerifiedAt: oauthProfile.emailVerified ? new Date() : null,
      },
    });
    await this.prisma.userRole.create({ data: { userId: newUser.id, roleId: studentRole.id } });
    await this.prisma.authProvider.create({
      data: {
        userId: newUser.id,
        provider: oauthProfile.provider,
        providerUserId: oauthProfile.providerUserId,
        providerEmail: oauthProfile.email,
      },
    });

    return this.issueSession(newUser.id, deviceFingerprint, ipAddress, userAgent);
  }

  async refresh(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    return this.refreshTokenService.rotate(rawRefreshToken, ipAddress, userAgent);
  }

  async logout(rawRefreshToken: string, sessionToken?: string) {
    await this.refreshTokenService.logout(rawRefreshToken);
    if (sessionToken) {
      await this.deviceService.deactivateSession(sessionToken);
    }
  }

  /**
   * تفعيل جلسة كاملة: تسجيل الجهاز (مع إنفاذ قيد عدد الأجهزة النشطة) +
   * إصدار Access + Refresh Token جديدين (عائلة Refresh جديدة).
   */
  private async issueSession(
    userId: string,
    deviceFingerprint?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    let deviceSessionToken: string | undefined;
    if (deviceFingerprint) {
      const device = await this.deviceService.registerDeviceSession(
        userId,
        deviceFingerprint,
        ipAddress,
        userAgent,
      );
      deviceSessionToken = device.sessionToken;
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastLoginDeviceId: device.id },
      });
    }

    const tokens = await this.refreshTokenService.issueNewFamily(
      userId,
      deviceFingerprint,
      ipAddress,
      userAgent,
    );

    return { ...tokens, deviceSessionToken };
  }
}
