import { Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { PaymentGatewayFactory } from './adapters/payment-gateway.factory';
import { GatewayProvider } from '@prisma/client';

/**
 * نقاط الـ Webhook لكل بوابة - بدون JwtAuthGuard عمدًا (البوابة الخارجية هي المُستدعي).
 * التحقق من صحة المصدر يتم عبر توقيع البوابة نفسها (signature) داخل كل Adapter،
 * وليس عبر JWT للمستخدم.
 *
 * ملاحظة حرجة: مسار Stripe تحديدًا (/webhooks/payments/stripe) يستقبل req.body كـ Buffer
 * خام وليس JS Object مُحلَّل - هذا مُفعَّل فعليًا في main.ts عبر express.raw() المُسجَّل
 * بأسبقية على express.json() العام. لا تُغيِّر هذا الترتيب أو ستفشل StripeAdapter.handleWebhook()
 * دائمًا (Stripe يحتاج البايتات الخام تحديدًا لحساب توقيع HMAC، وليس نصًا مُعاد تسلسله من JSON).
 *
 * كل بوابة تستخدم رأس توقيع مختلف تمامًا - نجمعها هنا ونمرر القيمة الصحيحة لكل Adapter:
 * Stripe: Stripe-Signature | PayPal: Paypal-Transmission-Sig | Tamara: X-Tamara-Notification-Token
 * Tabby: لا يوجد توقيع HMAC معياري - التحقق يتم بإعادة استعلام الحالة من Tabby API مباشرة.
 */
@Controller('webhooks/payments')
export class WebhooksController {
  constructor(
    private paymentsService: PaymentsService,
    private gatewayFactory: PaymentGatewayFactory,
  ) {}

  @Post(':provider')
  async handleWebhook(
    @Param('provider') provider: GatewayProvider,
    @Req() req: Request,
    @Headers('stripe-signature') stripeSignature: string,
    @Headers('paypal-transmission-sig') paypalSignature: string,
    @Headers('x-tamara-notification-token') tamaraToken: string,
  ) {
    const signature = stripeSignature || paypalSignature || tamaraToken || '';
    const adapter = this.gatewayFactory.getAdapter(provider);
    const event = await adapter.handleWebhook(req.body, signature);

    switch (event.eventType) {
      case 'payment_succeeded':
        await this.paymentsService.confirmPaymentSuccess(event.gatewayTransactionId, provider);
        break;
      case 'payment_failed':
        await this.paymentsService.confirmPaymentFailure(event.gatewayTransactionId, provider);
        break;
      case 'refund_completed':
        await this.paymentsService.confirmRefundCompleted(event.gatewayTransactionId, provider);
        break;
      default:
        break; // أحداث غير مهمة لمنطق الأعمال (مثل تحديثات حالة وسيطة) تُتجاهل بأمان
    }

    return { received: true };
  }
}
