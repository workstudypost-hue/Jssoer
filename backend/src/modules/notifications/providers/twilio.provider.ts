import { Injectable, Logger } from '@nestjs/common';
import { NotificationProvider, SendResult } from '../notification-provider.interface';

/**
 * تكامل Twilio Verify (وليس Twilio Programmable Messaging العادي) - مصمَّم خصيصًا
 * لتدفقات OTP: يتولى Twilio نفسه توليد الرمز والتحقق منه في خدمته، لكننا هنا
 * نستخدمه فقط كقناة إرسال (Send Only) ونُبقي التحقق الفعلي في OtpService محليًا
 * (بايت hash في قاعدتنا) للحفاظ على تحكّم كامل بسياسة المحاولات/الصلاحية كما صُمم.
 * لذلك نستخدم Messaging API القياسي عبر "from" رقم Twilio، وليس Verify Service.
 */
@Injectable()
export class TwilioProvider implements NotificationProvider {
  private readonly logger = new Logger(TwilioProvider.name);
  private client: any;
  private fromNumber: string;
  private whatsappFrom: string;

  constructor(private channel: 'sms' | 'whatsapp') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_SMS_FROM_NUMBER ?? '';
    this.whatsappFrom = process.env.TWILIO_WHATSAPP_FROM_NUMBER ?? '';

    if (accountSid && authToken) {
      // Lazy require لتفادي فشل الإقلاع في بيئة التطوير إن لم تُثبَّت الحزمة بعد
      // (Twilio SDK اختياري ما لم تُضبَط المفاتيح فعليًا)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio = require('twilio');
      this.client = twilio(accountSid, authToken);
    }
  }

  async send(to: string, body: string): Promise<SendResult> {
    if (!this.client) {
      this.logger.warn(
        `[DEV_ONLY] Twilio غير مُفعَّل (لا توجد مفاتيح API) - محاكاة إرسال إلى ${to}: ${body}`,
      );
      return { success: true, providerMessageId: 'dev-simulated' };
    }

    const from = this.channel === 'whatsapp' ? `whatsapp:${this.whatsappFrom}` : this.fromNumber;
    const destination = this.channel === 'whatsapp' ? `whatsapp:${to}` : to;

    try {
      const message = await this.client.messages.create({ to: destination, from, body });
      return { success: true, providerMessageId: message.sid, rawResponse: message };
    } catch (error) {
      this.logger.error(`فشل إرسال Twilio إلى ${to}: ${(error as Error).message}`);
      return { success: false, rawResponse: error };
    }
  }
}
