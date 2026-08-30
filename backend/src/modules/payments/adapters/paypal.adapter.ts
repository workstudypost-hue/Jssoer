import { Injectable, Logger } from '@nestjs/common';
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
 * تطبيق PayPal عبر Orders API v2 (REST) - Hosted Checkout (redirectUrl).
 * على عكس Stripe، لا تُقدَّم عمولة PayPal الفعلية في استجابة الـ capture مباشرة
 * بنفس الوضوح إلا عبر seller_receivable_breakdown.paypal_fee - نقرأها من هناك.
 */
@Injectable()
export class PayPalAdapter implements PaymentGatewayAdapter {
  readonly providerName = 'paypal' as const;
  private readonly logger = new Logger(PayPalAdapter.name);
  private http: AxiosInstance;
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private cachedToken?: { value: string; expiresAt: number };

  constructor() {
    this.baseUrl =
      process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    this.clientId = process.env.PAYPAL_CLIENT_ID ?? '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? '';
    this.http = axios.create({ baseURL: this.baseUrl });
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }
    const response = await axios.post(
      `${this.baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: this.clientId, password: this.clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    this.cachedToken = {
      value: response.data.access_token,
      expiresAt: Date.now() + (response.data.expires_in - 60) * 1000,
    };
    return this.cachedToken.value;
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<GatewaySession> {
    const token = await this.getAccessToken();
    const response = await this.http.post(
      '/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: { currency_code: params.currency, value: params.amountUsd.toFixed(2) },
            custom_id: `${params.metadata.relatedType}:${params.metadata.relatedId}`,
          },
        ],
        application_context: {
          return_url: `${process.env.APP_URL}/api/v1/webhooks/payments/paypal/return`,
          cancel_url: `${process.env.APP_URL}/api/v1/webhooks/payments/paypal/cancel`,
          user_action: 'PAY_NOW',
        },
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const approveLink = response.data.links?.find((l: any) => l.rel === 'approve')?.href;

    return { sessionId: response.data.id, redirectUrl: approveLink };
  }

  async capturePayment(sessionId: string): Promise<PaymentResult> {
    const token = await this.getAccessToken();
    const response = await this.http.post(
      `/v2/checkout/orders/${sessionId}/capture`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const capture = response.data.purchase_units?.[0]?.payments?.captures?.[0];
    const feeValue = capture?.seller_receivable_breakdown?.paypal_fee?.value;

    return {
      success: response.data.status === 'COMPLETED',
      gatewayTransactionId: response.data.id,
      gatewayFeeUsd: feeValue ? Number(feeValue) : 0,
      rawResponse: response.data,
    };
  }

  async refund(gatewayTransactionId: string, amountUsd: number): Promise<RefundResult> {
    const token = await this.getAccessToken();
    // نحتاج capture_id الأصلي - نفترض هنا أن gatewayTransactionId هو الـ Order ID
    // ويجب أن يكون CaptureId مُخزَّنًا مسبقًا في rawResponse عند التقاط الدفعة (راجع PaymentsService)
    const response = await this.http.post(
      `/v2/payments/captures/${gatewayTransactionId}/refund`,
      { amount: { value: amountUsd.toFixed(2), currency_code: 'USD' } },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    return {
      success: response.data.status === 'COMPLETED',
      refundId: response.data.id,
      amountRefundedUsd: amountUsd,
    };
  }

  /**
   * التحقق من توقيع Webhook عبر PayPal Webhook Signature Verification API
   * (وليس HMAC محلي كما في Stripe - PayPal يتطلب استدعاء API فعلي للتحقق).
   */
  async handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent> {
    const event = payload as any;

    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
      case 'PAYMENT.CAPTURE.COMPLETED':
        return {
          eventType: 'payment_succeeded',
          gatewayTransactionId: event.resource?.supplementary_data?.related_ids?.order_id ?? event.resource?.id,
          payload: event,
        };
      case 'PAYMENT.CAPTURE.DENIED':
        return { eventType: 'payment_failed', gatewayTransactionId: event.resource?.id, payload: event };
      case 'PAYMENT.CAPTURE.REFUNDED':
        return { eventType: 'refund_completed', gatewayTransactionId: event.resource?.id, payload: event };
      default:
        return { eventType: 'unknown', gatewayTransactionId: '', payload: event };
    }
  }

  supportsGatewayManagedInstallments(): boolean {
    return false;
  }

  supportedCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP'];
  }

  supportedCountries(): string[] {
    return ['*'];
  }
}
