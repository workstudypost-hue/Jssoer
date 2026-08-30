import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  PaymentGatewayAdapter,
  CreatePaymentIntentParams,
  GatewaySession,
  PaymentResult,
  RefundResult,
  WebhookEvent,
} from './payment-gateway.adapter';

/**
 * تطبيق Tabby (BNPL - السعودية/الإمارات/الكويت) عبر Tabby Checkout API الفعلي.
 * الفرق الجوهري عن Stripe: Tabby تُحوِّل للمنصة كامل المبلغ فورًا،
 * وهي من تُحصِّل الأقساط من الطالب مباشرة وتتحمّل مخاطر التعثر.
 * لذلك supportsGatewayManagedInstallments() = true، ولا Cron تحصيل داخلي لهذه الحالة.
 * التوثيق الرسمي: https://docs.tabby.ai
 */
@Injectable()
export class TabbyAdapter implements PaymentGatewayAdapter {
  readonly providerName = 'tabby' as const;
  private http: AxiosInstance;
  private publicKey: string;

  constructor() {
    const baseUrl = process.env.TABBY_ENV === 'live' ? 'https://api.tabby.ai' : 'https://api.tabby.ai';
    this.publicKey = process.env.TABBY_PUBLIC_KEY ?? '';
    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${process.env.TABBY_API_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<GatewaySession> {
    const response = await this.http.post('/api/v2/checkout', {
      payment: {
        amount: params.amountUsd.toFixed(2),
        currency: params.currency,
        description: 'دفعة منصة Work Study التعليمية',
        buyer: { email: params.metadata.studentEmail ?? '', phone: params.metadata.studentPhone ?? '' },
        order: {
          reference_id: `${params.metadata.relatedType}:${params.metadata.relatedId}`,
          items: [
            {
              title: params.metadata.relatedType === 'course_enrollment' ? 'اشتراك دورة' : 'طلب مخصص',
              quantity: 1,
              unit_price: params.amountUsd.toFixed(2),
              reference_id: params.metadata.relatedId,
            },
          ],
        },
        buyer_history: { registered_since: new Date().toISOString(), loyalty_level: 0 },
      },
      lang: 'ar',
      merchant_code: process.env.TABBY_MERCHANT_CODE ?? 'default',
      merchant_urls: {
        success: `${process.env.FRONTEND_URL}/payments/tabby/success`,
        cancel: `${process.env.FRONTEND_URL}/payments/tabby/cancel`,
        failure: `${process.env.FRONTEND_URL}/payments/tabby/failure`,
      },
    });

    const paymentId = response.data.payment.id;
    const checkoutUrl = response.data.configuration?.available_products?.installments?.[0]?.web_url;

    return { sessionId: paymentId, redirectUrl: checkoutUrl };
  }

  async capturePayment(sessionId: string): Promise<PaymentResult> {
    const paymentResponse = await this.http.get(`/api/v2/payments/${sessionId}`);
    const status = paymentResponse.data.status;

    if (status !== 'AUTHORIZED' && status !== 'CLOSED') {
      return { success: false, gatewayTransactionId: sessionId, gatewayFeeUsd: 0, rawResponse: paymentResponse.data };
    }

    // capture فعلي فقط إن كانت لا تزال AUTHORIZED (وليست CLOSED مسبقًا)
    if (status === 'AUTHORIZED') {
      await this.http.post(`/api/v2/payments/${sessionId}/captures`, {
        amount: paymentResponse.data.amount,
      });
    }

    return {
      success: true,
      gatewayTransactionId: sessionId,
      // Tabby تُطبِّق عمولتها كنسبة متفق عليها تجاريًا وليست مُرجَعة عبر الـ API لكل معاملة -
      // تُدار عبر commission_policies بدل قراءتها من الاستجابة (خلافًا لـ Stripe)
      gatewayFeeUsd: 0,
      rawResponse: paymentResponse.data,
    };
  }

  async refund(gatewayTransactionId: string, amountUsd: number): Promise<RefundResult> {
    const response = await this.http.post(`/api/v2/payments/${gatewayTransactionId}/refunds`, {
      amount: amountUsd.toFixed(2),
      reason: 'طلب استرداد من المنصة',
    });

    return {
      success: true,
      refundId: response.data.id,
      amountRefundedUsd: amountUsd,
    };
  }

  /** Tabby ترسل Webhook بسيط دون توقيع HMAC معياري - التحقق يعتمد على استدعاء GET للتأكد من الحالة فعليًا */
  async handleWebhook(payload: unknown, _signature: string): Promise<WebhookEvent> {
    const event = payload as any;
    const paymentId = event.id;

    // إعادة جلب الحالة مباشرة من Tabby بدل الثقة بجسم الـ Webhook وحده (دفاع ضد التزوير)
    const verified = await this.http.get(`/api/v2/payments/${paymentId}`);
    const status = verified.data.status;

    if (status === 'AUTHORIZED' || status === 'CLOSED') {
      return { eventType: 'payment_succeeded', gatewayTransactionId: paymentId, payload: verified.data };
    }
    if (status === 'REJECTED' || status === 'EXPIRED') {
      return { eventType: 'payment_failed', gatewayTransactionId: paymentId, payload: verified.data };
    }
    if (status === 'REFUNDED') {
      return { eventType: 'refund_completed', gatewayTransactionId: paymentId, payload: verified.data };
    }
    return { eventType: 'unknown', gatewayTransactionId: paymentId, payload: verified.data };
  }

  supportsGatewayManagedInstallments(): boolean {
    return true;
  }

  supportedCurrencies(): string[] {
    return ['SAR', 'AED', 'KWD'];
  }

  supportedCountries(): string[] {
    return ['SA', 'AE', 'KW'];
  }
}
