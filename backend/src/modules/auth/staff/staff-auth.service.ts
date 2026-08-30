import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { RefreshTokenService } from '../refresh-token.service';
import { CreateStaffInvitationDto } from '../dto/create-staff-invitation.dto';
import { AcceptStaffInvitationDto } from '../dto/accept-staff-invitation.dto';
import { LoginDto } from '../dto/login.dto';

const INVITATION_EXPIRY_HOURS = 48;

@Injectable()
export class StaffAuthService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * ينشئها super_admin حصريًا (يُطبَّق عبر PermissionsGuard على الـ Controller).
   * لا يوجد مسار عام لإنشاء حساب موظف بأي طريقة أخرى.
   */
  async createInvitation(dto: CreateStaffInvitationDto, invitedById: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new BadRequestException('يوجد مستخدم مسجَّل مسبقًا بهذا البريد');
    }

    // إبطال أي دعوة سابقة سارية لنفس البريد (Token يُستهلك مرة واحدة فقط)
    await this.prisma.staffInvitation.updateMany({
      where: { email: dto.email, status: 'pending' },
      data: { status: 'revoked' },
    });

    const token = nanoid(32);
    const invitation = await this.prisma.staffInvitation.create({
      data: {
        email: dto.email,
        invitedRoleId: dto.roleId,
        invitedById,
        token,
        expiresAt: new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    });

    const acceptUrl = `${process.env.FRONTEND_URL}/staff/accept-invitation?token=${token}`;
    await this.notifications.sendEmail(
      dto.email,
      `تمت دعوتك للانضمام كموظف في منصة Work Study. لإكمال إعداد حسابك، افتح الرابط التالي خلال ${INVITATION_EXPIRY_HOURS} ساعة:\n${acceptUrl}`,
    );

    return { invitationId: invitation.id, expiresAt: invitation.expiresAt };
  }

  /**
   * الموظف يفتح الرابط ويُكمل إعداد حسابه (تعيين كلمة مرور).
   */
  async acceptInvitation(dto: AcceptStaffInvitationDto) {
    const invitation = await this.prisma.staffInvitation.findUnique({
      where: { token: dto.token },
    });

    if (!invitation || invitation.status !== 'pending') {
      throw new BadRequestException('رابط الدعوة غير صالح أو مُستخدَم مسبقًا');
    }
    if (invitation.expiresAt < new Date()) {
      await this.prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('انتهت صلاحية رابط الدعوة');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          isStaff: true,
          registrationType: 'staff_invitation',
          preferredLocale: 'ar',
          status: 'active',
          emailVerifiedAt: new Date(), // بريد موظف موثوق ضمنيًا عبر قناة الدعوة الإدارية
        },
      });

      await tx.userRole.create({
        data: { userId: newUser.id, roleId: invitation.invitedRoleId, assignedBy: invitation.invitedById },
      });

      await tx.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted' },
      });

      await tx.activityLog.create({
        data: {
          actorId: newUser.id,
          actorRole: 'staff',
          action: 'staff.account_activated',
          resourceType: 'user',
          resourceId: newUser.id,
        },
      });

      return newUser;
    });

    return this.issueTokens(user.id);
  }

  /**
   * تسجيل دخول منفصل تمامًا للموظفين (isStaff: true فقط).
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.identifier, isStaff: true },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('الحساب غير نشط');
    }

    await this.prisma.activityLog.create({
      data: {
        actorId: user.id,
        actorRole: 'staff',
        action: 'staff.login',
        resourceType: 'user',
        resourceId: user.id,
      },
    });

    return this.issueTokens(user.id);
  }

  private async issueTokens(userId: string) {
    // يستخدم الآن نفس RefreshTokenService الفعلي (Rotation + كشف إعادة الاستخدام)
    // المُستخدَم للطلاب/المدربين - كان الموظفون سابقًا على توقيع JWT بسيط بلا Rotation
    // ولا تخزين/إبطال فعلي (فجوة أمنية موثقة: Refresh Token للموظفين لم يكن قابلاً
    // للإبطال إطلاقًا قبل انتهاء صلاحيته الطبيعية).
    return this.refreshTokenService.issueNewFamily(userId, undefined, undefined, undefined, true);
  }

  /** تدوير Refresh Token لجلسة موظف (نفس منطق الطلاب/المدربين تمامًا) */
  async refresh(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    return this.refreshTokenService.rotate(rawRefreshToken, ipAddress, userAgent);
  }

  async logout(rawRefreshToken: string) {
    return this.refreshTokenService.logout(rawRefreshToken);
  }
}
