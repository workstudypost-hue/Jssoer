/**
 * واجهة موحّدة لكل بوابات الدفع (Stripe/PayPal/Tabby/Tamara).
 * أي منطق أعمال (PaymentsService) يتعامل فقط مع هذه الواجهة،
 * ولا يعرف إطلاقًا أي تفاصيل خاصة ببوابة معيّنة.
 * إضافة بوابة خامسة مستقبلاً = إضافة Adapter جديد فقط، بدون لمس أي كود آخر.
 */

export interface CreatePaymentIntentParams {
  amountUsd: number;
  currency: string;
  studentId: string;
  metadata: Record<string, string>;
}

export interface GatewaySession {
  sessionId: string;
  clientSecret?: string;   // لـ Stripe (Frontend يُكمل التدفق به)
  redirectUrl?: string;    // لـ PayPal/Tabby/Tamara (Hosted Checkout)
}

export interface PaymentResult {
  success: boolean;
  gatewayTransactionId: string;
  gatewayFeeUsd: number;   // القيمة الفعلية من الـ Webhook - وليست تقديرًا
  rawResponse: unknown;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amountRefundedUsd: number;
}

export interface WebhookEvent {
  eventType: 'payment_succeeded' | 'payment_failed' | 'refund_completed' | 'unknown';
  gatewayTransactionId: string;
  payload: unknown;
}

export interface PaymentGatewayAdapter {
  readonly providerName: 'stripe' | 'paypal' | 'tabby' | 'tamara';

  createPaymentIntent(params: CreatePaymentIntentParams): Promise<GatewaySession>;
  capturePayment(sessionId: string): Promise<PaymentResult>;
  refund(gatewayTransactionId: string, amountUsd: number): Promise<RefundResult>;
  handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent>;

  /**
   * تحصيل مبلغ من بطاقة محفوظة مسبقًا دون تدخل الطالب (Off-Session) - يُستخدم
   * حصريًا في تحصيل أقساط installmentManagement='internal' (راجع PaymentPlansService).
   * غير مدعوم لبوابات BNPL (Tabby/Tamara تُدير تحصيلها الخاص بمعزل عن نظامنا).
   */
  chargeSavedPaymentMethod?(params: {
    gatewayCustomerId: string;
    gatewayPaymentMethodId: string;
    amountUsd: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<PaymentResult>;

  /** هل تدعم هذه البوابة تقسيطًا مُدارًا من طرفها (BNPL)؟ Tabby/Tamara = true */
  supportsGatewayManagedInstallments(): boolean;
  supportedCurrencies(): string[];
  supportedCountries(): string[];
}
