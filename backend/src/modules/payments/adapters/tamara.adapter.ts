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
 * تطبيق Tamara (BNPL - السعودية/الإمارات/الكويت) عبر Checkout API.
 * مثل Tabby: Tamara تُحوِّل كامل المبلغ للمنصة فورًا وتتحمّل هي مخاطر تحصيل
 * الأقساط من الطالب مباشرة، لذلك installmentManagement='gateway_managed'
 * لأي خطة تُنشأ عبرها (لا Cron تحصيل داخلي).
 */
@Injectable()
export class TamaraAdapter implements PaymentGatewayAdapter {
  readonly providerName = 'tamara' as const;
  private http: AxiosInstance;
  private apiToken: string;
  private notifyToken: string;

  constructor() {
    const baseUrl =
      process.env.TAMARA_ENV === 'live' ? 'https://api.tamara.co' : 'https://api-sandbox.tamara.co';
    this.apiToken = process.env.TAMARA_API_TOKEN ?? '';
    this.notifyToken = process.env.TAMARA_NOTIFICATION_TOKEN ?? '';
    this.http = axios.create({
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${this.apiToken}`, 'Content-Type': 'application/json' },
    });
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<GatewaySession> {
    const response = await this.http.post('/checkout', {
      total_amount: { amount: params.amountUsd.toFixed(2), currency: params.currency },
      order_reference_id: `${params.metadata.relatedType}:${params.metadata.relatedId}`,
      order_number: params.metadata.relatedId,
      country_code: 'SA',
      description: 'دفعة منصة Work Study التعليمية',
      merchant_url: {
        success: `${process.env.FRONTEND_URL}/payments/tamara/success`,
        failure: `${process.env.FRONTEND_URL}/payments/tamara/failure`,
        cancel: `${process.env.FRONTEND_URL}/payments/tamara/cancel`,
        notification: `${process.env.APP_URL}/api/v1/webhooks/payments/tamara`,
      },
      // تفاصيل الطالب/عناصر السلة الفعلية يجب تمريرها من PaymentsService عبر metadata موسّعة
      consumer: { email: params.metadata.studentEmail ?? '' },
    });

    return {
      sessionId: response.data.order_id,
      redirectUrl: response.data.checkout_url,
    };
  }

  async capturePayment(sessionId: string): Promise<PaymentResult> {
    // Tamara: authorise أولًا ثم capture - نفترض أن authorise حدث تلقائيًا بعد موافقة العميل
    // في صفحة Tamara نفسها (Webhook order_approved) ونُنفِّذ capture هنا صراحة
    const order = await this.http.get(`/orders/${sessionId}`);
    const authorised = order.data.status === 'approved' || order.data.status === 'authorised';

    if (!authorised) {
      return { success: false, gatewayTransactionId: sessionId, gatewayFeeUsd: 0, rawResponse: order.data };
    }

    const captureResponse = await this.http.post('/payments/capture', {
      order_id: sessionId,
      total_amount: order.data.total_amount,
    });

    return {
      success: captureResponse.data.status === 'fully_captured',
      gatewayTransactionId: sessionId,
      // Tamara لا تُرجع عمولتها الفعلية عبر الـ API مباشرة (تُسوَّى شهريًا في كشف حساب منفصل) -
      // نُسجِّل 0 هنا مؤقتًا ونعتمد على مطابقة الكشف الشهري لتحديث القيمة الفعلية لاحقًا
      gatewayFeeUsd: 0,
      rawResponse: captureResponse.data,
    };
  }

  async refund(gatewayTransactionId: string, amountUsd: number): Promise<RefundResult> {
    const response = await this.http.post('/payments/refund', {
      order_id: gatewayTransactionId,
      total_amount: { amount: amountUsd.toFixed(2), currency: 'SAR' },
    });

    return {
      success: response.data.status === 'approved' || response.data.status === 'pending',
      refundId: response.data.refund_id,
      amountRefundedUsd: amountUsd,
    };
  }

  /** Tamara توقّع الإشعارات عبر رأس محدد يُقارَن مباشرة بـ Notification Token المُسجَّل */
  async handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent> {
    if (signature !== this.notifyToken) {
      throw new Error('توقيع Webhook من Tamara غير صالح');
    }

    const event = payload as any;
    switch (event.order_status) {
      case 'approved':
      case 'fully_captured':
        return { eventType: 'payment_succeeded', gatewayTransactionId: event.order_id, payload: event };
      case 'declined':
      case 'canceled':
        return { eventType: 'payment_failed', gatewayTransactionId: event.order_id, payload: event };
      case 'fully_refunded':
      case 'partially_refunded':
        return { eventType: 'refund_completed', gatewayTransactionId: event.order_id, payload: event };
      default:
        return { eventType: 'unknown', gatewayTransactionId: event.order_id ?? '', payload: event };
    }
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
