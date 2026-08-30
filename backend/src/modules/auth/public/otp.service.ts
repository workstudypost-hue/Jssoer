import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OtpChannel, OtpPurpose } from '@prisma/client';

// حد الطلبات المتكررة يُعامَل كخطأ طلب عادي (400) مع رسالة واضحة للمستخدم
class RateLimitException extends BadRequestException {}

@Injectable()
export class OtpService {
  private readonly OTP_LENGTH = 6;
  private readonly EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES ?? 10);
  private readonly MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
  // حد إرسال الطلبات لتفادي OTP Bombing (كما صُمم في نظام الأمان)
  private readonly MAX_REQUESTS_PER_WINDOW = 3;
  private readonly REQUEST_WINDOW_MINUTES = 10;
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * توليد وإرسال رمز OTP جديد لـ identifier معيّن.
   * (الإرسال الفعلي عبر Twilio/SendGrid يُستبدل هنا بـ TODO - راجع production-notes.md)
   */
  async generateAndSend(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
    userId?: string,
  ) {
    // فحص Rate limiting: لا أكثر من 3 طلبات OTP لكل identifier خلال 10 دقائق
    const recentRequestsCount = await this.prisma.otpVerification.count({
      where: {
        identifier,
        purpose,
        createdAt: { gte: new Date(Date.now() - this.REQUEST_WINDOW_MINUTES * 60 * 1000) },
      },
    });
    if (recentRequestsCount >= this.MAX_REQUESTS_PER_WINDOW) {
      throw new RateLimitException(
        'تم تجاوز الحد المسموح لطلبات رمز التحقق. حاول لاحقًا.',
      );
    }

    const code = this.generateNumericCode();
    const codeHash = await bcrypt.hash(code, 10);

    await this.prisma.otpVerification.create({
      data: {
        userId,
        identifier,
        channel,
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1000),
      },
    });

    // إرسال فعلي عبر Twilio (SMS/WhatsApp) أو SendGrid (Email) حسب القناة.
    // في حال عدم ضبط مفاتيح API فعلية، يُحاكي المزود الإرسال ويسجّل تحذيرًا فقط
    // (بيئة تطوير) بدل فشل التسجيل بالكامل - راجع notifications module.
    const messageBody = `رمز التحقق الخاص بك في منصة Work Study هو: ${code}\nصالح لمدة ${this.EXPIRY_MINUTES} دقائق. لا تشارك هذا الرمز مع أي شخص.`;
    const sendResult = await this.notifications.sendByChannel(channel, identifier, messageBody);

    if (!sendResult.success) {
      this.logger.error(`فشل إرسال OTP فعليًا لـ ${identifier} عبر ${channel}`);
      // لا نُفشل الطلب بالكامل هنا (الرمز مُخزَّن وصالح) - لكن نُسجِّل الخطأ لمتابعة العمليات
    }

    return { sentTo: identifier, channel, expiresInMinutes: this.EXPIRY_MINUTES };
  }

  /**
   * التحقق من صحة الرمز المُدخَل من المستخدم.
   */
  async verify(identifier: string, code: string, purpose: OtpPurpose): Promise<boolean> {
    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: { identifier, purpose, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('لا يوجد طلب تحقق سارٍ لهذا المعرّف');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('انتهت صلاحية رمز التحقق، يُرجى طلب رمز جديد');
    }

    if (otpRecord.attemptsCount >= otpRecord.maxAttempts) {
      throw new BadRequestException('تم تجاوز عدد المحاولات المسموحة لهذا الرمز');
    }

    const isValid = await bcrypt.compare(code, otpRecord.codeHash);

    if (!isValid) {
      await this.prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attemptsCount: { increment: 1 } },
      });
      throw new BadRequestException('رمز التحقق غير صحيح');
    }

    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    return true;
  }

  private generateNumericCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
