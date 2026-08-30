import { Injectable, Logger } from '@nestjs/common';
import { NotificationProvider, SendResult } from '../notification-provider.interface';

@Injectable()
export class SendGridProvider implements NotificationProvider {
  private readonly logger = new Logger(SendGridProvider.name);
  private client: any;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'no-reply@example.com';

    if (apiKey) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(apiKey);
      this.client = sgMail;
    }
  }

  async send(to: string, body: string): Promise<SendResult> {
    if (!this.client) {
      this.logger.warn(
        `[DEV_ONLY] SendGrid غير مُفعَّل (لا يوجد API key) - محاكاة إرسال بريد إلى ${to}: ${body}`,
      );
      return { success: true, providerMessageId: 'dev-simulated' };
    }

    try {
      const [response] = await this.client.send({
        to,
        from: this.fromEmail,
        subject: 'رمز التحقق - منصة Work Study',
        text: body,
        html: `<p style="font-family:sans-serif;font-size:16px">${body}</p>`,
      });
      return {
        success: response.statusCode >= 200 && response.statusCode < 300,
        providerMessageId: response.headers['x-message-id'],
        rawResponse: response,
      };
    } catch (error) {
      this.logger.error(`فشل إرسال SendGrid إلى ${to}: ${(error as Error).message}`);
      return { success: false, rawResponse: error };
    }
  }
}
