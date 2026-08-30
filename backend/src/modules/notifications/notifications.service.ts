import { Injectable } from '@nestjs/common';
import { OtpChannel } from '@prisma/client';
import { TwilioProvider } from './providers/twilio.provider';
import { SendGridProvider } from './providers/sendgrid.provider';
import { SendResult } from './notification-provider.interface';

/**
 * نقطة الدخول الوحيدة لإرسال أي إشعار خارجي (SMS/WhatsApp/Email) عبر المنصة -
 * نفس فكرة AI Gateway وPaymentGatewayFactory: منطق الأعمال لا يعرف تفاصيل المزود.
 */
@Injectable()
export class NotificationsService {
  private smsProvider = new TwilioProvider('sms');
  private whatsappProvider = new TwilioProvider('whatsapp');
  private emailProvider = new SendGridProvider();

  async sendByChannel(channel: OtpChannel, to: string, body: string): Promise<SendResult> {
    switch (channel) {
      case 'sms':
        return this.smsProvider.send(to, body);
      case 'whatsapp':
        return this.whatsappProvider.send(to, body);
      case 'email':
        return this.emailProvider.send(to, body);
      default:
        throw new Error(`قناة إشعار غير مدعومة: ${channel}`);
    }
  }

  async sendEmail(to: string, body: string): Promise<SendResult> {
    return this.emailProvider.send(to, body);
  }
}
