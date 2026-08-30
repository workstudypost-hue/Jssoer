import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import {
  PaymentGatewayAdapter,
  CreatePaymentIntentParams,
  GatewaySession,
  PaymentResult,
  RefundResult,
  WebhookEvent,
} from './payment-gateway.adapter';

/**
 * تطبيق Stripe لواجهة PaymentGatewayAdapter.
 * يغطي البطاقات (Visa/Mastercard/Amex) عالميًا.
 * لا يُخزَّن أي رقم بطاقة خام - Stripe Elements في الـ Frontend يتولى الـ Tokenization
 * مباشرة، ونحن نتعامل فقط مع PaymentIntent/PaymentMethod IDs (PCI-DSS SAQ-A).
 */
@Injectable()
export class StripeAdapter implements PaymentGatewayAdapter {
  readonly providerName = 'stripe' as const;
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2024-06-20',
    });
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<GatewaySession> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(params.amountUsd * 100), // Stripe يتعامل بالسنت
      currency: params.currency.toLowerCase(),
      metadata: params.metadata,
      // Automatic Payment Methods يسمح بعرض كل طرق الدفع المتاحة تلقائيًا حسب دولة العميل
      automatic_payment_methods: { enabled: true },
    });

    return {
      sessionId: intent.id,
      clientSecret: intent.client_secret ?? undefined,
    };
  }

  async capturePayment(sessionId: string): Promise<PaymentResult> {
    const intent = await this.stripe.paymentIntents.retrieve(sessionId, {
      expand: ['latest_charge.balance_transaction'],
    });

    const charge = intent.latest_charge as Stripe.Charge | null;
    const balanceTransaction = charge?.balance_transaction as Stripe.BalanceTransaction | null;

    // عمولة Stripe الفعلية (وليست تقديرًا بنسبة ثابتة) - تأتي من balance_transaction.fee
    const gatewayFeeUsd = balanceTransaction ? balanceTransaction.fee / 100 : 0;

    return {
      success: intent.status === 'succeeded',
      gatewayTransactionId: intent.id,
      gatewayFeeUsd,
      rawResponse: intent,
    };
  }

  async refund(gatewayTransactionId: string, amountUsd: number): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: gatewayTransactionId,
      amount: Math.round(amountUsd * 100),
    });

    return {
      success: refund.status === 'succeeded' || refund.status === 'pending',
      refundId: refund.id,
      amountRefundedUsd: refund.amount / 100,
    };
  }

  async handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent> {
    const event = this.stripe.webhooks.constructEvent(
      payload as string | Buffer,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? '',
    );

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        return { eventType: 'payment_succeeded', gatewayTransactionId: intent.id, payload: event };
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        return { eventType: 'payment_failed', gatewayTransactionId: intent.id, payload: event };
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        return {
          eventType: 'refund_completed',
          gatewayTransactionId: charge.payment_intent as string,
          payload: event,
        };
      }
      default:
        return { eventType: 'unknown', gatewayTransactionId: '', payload: event };
    }
  }

  supportsGatewayManagedInstallments(): boolean {
    return false; // Stripe نفسه لا يدير BNPL هنا - التقسيط الداخلي يُدار من نظامنا
  }

  /**
   * تحصيل قسط مستحق من بطاقة محفوظة مسبقًا دون تدخل الطالب (Off-Session PaymentIntent).
   * تُستخدم من PaymentPlansService.processDueInstallments() فقط - راجع production-notes.md
   * كان هذا سابقًا TODO(production) صريحًا؛ الآن مُنفَّذ فعليًا عبر Stripe PaymentIntents
   * مع off_session:true وconfirm:true، بأمان (PaymentMethod كان مُرفَقًا مسبقًا بالعميل
   * أثناء أول عملية دفع كاملة تفاعلية - راجع SavedPaymentMethod).
   */
  async chargeSavedPaymentMethod(params: {
    gatewayCustomerId: string;
    gatewayPaymentMethodId: string;
    amountUsd: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<PaymentResult> {
    try {
      const intent = await this.stripe.paymentIntents.create({
        amount: Math.round(params.amountUsd * 100),
        currency: params.currency.toLowerCase(),
        customer: params.gatewayCustomerId,
        payment_method: params.gatewayPaymentMethodId,
        off_session: true,
        confirm: true,
        metadata: params.metadata,
        expand: ['latest_charge.balance_transaction'],
      });

      const charge = intent.latest_charge as Stripe.Charge | null;
      const balanceTransaction = charge?.balance_transaction as Stripe.BalanceTransaction | null;
      const gatewayFeeUsd = balanceTransaction ? balanceTransaction.fee / 100 : 0;

      return {
        success: intent.status === 'succeeded',
        gatewayTransactionId: intent.id,
        gatewayFeeUsd,
        rawResponse: intent,
      };
    } catch (error) {
      // فشل شائع: authentication_required (تتطلب البطاقة 3-D Secure تفاعليًا)
      // - يجب أن يُترجَم هذا لإشعار الطالب بإكمال الدفع يدويًا، وليس فشلًا صامتًا
      const stripeError = error as Stripe.errors.StripeError;
      return {
        success: false,
        gatewayTransactionId: stripeError.payment_intent?.id ?? '',
        gatewayFeeUsd: 0,
        rawResponse: { error: stripeError.message, code: stripeError.code },
      };
    }
  }

  supportedCurrencies(): string[] {
    return ['USD', 'EUR', 'SAR', 'AED', 'PHP', 'JOD', 'EGP'];
  }

  supportedCountries(): string[] {
    return ['*']; // عالمي
  }
}
