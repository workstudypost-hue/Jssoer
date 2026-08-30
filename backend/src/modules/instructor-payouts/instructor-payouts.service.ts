import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutFrequency } from '@prisma/client';

const FREQUENCY_DAYS: Record<PayoutFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

@Injectable()
export class InstructorPayoutsService {
  private readonly logger = new Logger(InstructorPayoutsService.name);
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' });

  constructor(private prisma: PrismaService) {}

  /**
   * يُستدعى فعليًا من PayoutsScheduler (BullMQ) يوميًا - لكل مدرب لديه أرباح
   * محرَّرة (cleared) غير مُدرجة بعد في أي دفعة، يُنشئ payout فقط إن كان اليوم
   * مناسبًا فعليًا حسب payout_frequency الفردي الخاص به (وليس نافذة 30 يومًا
   * موحّدة على الجميع كما كان سابقًا - فجوة موثقة تم إصلاحها الآن).
   */
  async generateDuePayouts() {
    const eligibleEarnings = await this.prisma.instructorEarning.findMany({
      where: { status: 'cleared', payoutId: null },
      select: { instructorId: true },
      distinct: ['instructorId'],
    });

    const periodEnd = new Date();
    const results = [];

    for (const { instructorId } of eligibleEarnings) {
      const profile = await this.prisma.instructorProfile.findUnique({ where: { userId: instructorId } });
      if (!profile || !profile.isPayoutEligible) continue;

      const frequencyDays = FREQUENCY_DAYS[profile.payoutFrequency];
      const dueDate = profile.lastPayoutGeneratedAt
        ? new Date(profile.lastPayoutGeneratedAt.getTime() + frequencyDays * 24 * 60 * 60 * 1000)
        : new Date(0); // لم يُصرَف له أي دفعة سابقًا → مؤهَّل فورًا لأول دورة

      if (periodEnd < dueDate) {
        continue; // لم يحن دوره بعد حسب تكراره المُفضَّل
      }

      const periodStart = profile.lastPayoutGeneratedAt ?? new Date(periodEnd.getTime() - frequencyDays * 24 * 60 * 60 * 1000);
      const payout = await this.generatePayoutForInstructor(instructorId, periodStart, periodEnd);
      if (payout) {
        await this.prisma.instructorProfile.update({
          where: { userId: instructorId },
          data: { lastPayoutGeneratedAt: periodEnd },
        });
        results.push(payout.id);
      }
    }
    return { generatedPayoutIds: results };
  }

  /**
   * Cron دوري (حسب payout_frequency لكل مدرب): يجمّع كل الأرباح المُحرَّرة
   * (status='cleared', payoutId=null) وينشئ payout واحدًا، محددًا هل يتطلب
   * موافقة مزدوجة بناءً على dual_approval_thresholds (500$ افتراضيًا).
   */
  async generatePayoutForInstructor(instructorId: string, periodStart: Date, periodEnd: Date) {
    const clearedEarnings = await this.prisma.instructorEarning.findMany({
      where: { instructorId, status: 'cleared', payoutId: null },
    });
    if (clearedEarnings.length === 0) return null;

    const grossAmount = clearedEarnings.reduce((sum, e) => sum + Number(e.instructorEarningUsd), 0);

    const pendingDeductions = await this.prisma.instructorDeduction.findMany({
      where: { instructorId, status: 'pending' },
    });
    const deductionsTotal = pendingDeductions.reduce((sum, d) => sum + Number(d.amountUsd), 0);
    const netAmountUsd = grossAmount - deductionsTotal;

    const profile = await this.prisma.instructorProfile.findUnique({ where: { userId: instructorId } });
    const threshold = Number(profile?.minimumPayoutThreshold ?? 50);
    if (netAmountUsd < threshold) {
      // لا يُنشأ payout - يتراكم تلقائيًا للدورة القادمة (الأرباح تبقى بلا payoutId)
      return null;
    }

    const dualApprovalRule = await this.prisma.dualApprovalThreshold.findFirst({
      where: { isActive: true },
      orderBy: { minAmountUsd: 'asc' },
    });
    const requiresDualApproval = dualApprovalRule
      ? netAmountUsd >= Number(dualApprovalRule.minAmountUsd)
      : false;

    const payout = await this.prisma.$transaction(async (tx) => {
      const created = await tx.instructorPayout.create({
        data: {
          instructorId,
          periodStart,
          periodEnd,
          grossAmount,
          netAmountUsd,
          requiresDualApproval,
          status: 'calculated',
        },
      });

      await tx.instructorEarning.updateMany({
        where: { id: { in: clearedEarnings.map((e) => e.id) } },
        data: { payoutId: created.id },
      });

      await tx.instructorDeduction.updateMany({
        where: { id: { in: pendingDeductions.map((d) => d.id) } },
        data: { status: 'deducted', appliedToPayoutId: created.id },
      });

      return created;
    });

    return payout;
  }

  /**
   * الموافقة الأولى (finance_manager). إن لم تكن الدفعة تتطلب موافقة مزدوجة،
   * هذه الموافقة الوحيدة كافية → approved مباشرة.
   */
  async firstApproval(payoutId: string, approverId: string) {
    const payout = await this.prisma.instructorPayout.findUniqueOrThrow({ where: { id: payoutId } });

    if (payout.status !== 'calculated') {
      throw new BadRequestException('هذه الدفعة ليست بانتظار الموافقة الأولى');
    }

    const nextStatus = payout.requiresDualApproval ? 'pending_second_approval' : 'approved';

    return this.prisma.instructorPayout.update({
      where: { id: payoutId },
      data: {
        firstApprovalById: approverId,
        firstApprovalAt: new Date(),
        status: nextStatus,
      },
    });
  }

  /**
   * الموافقة الثانية (super_admin) - إلزامية فقط عند requiresDualApproval=true.
   * الفصل الفعلي بين الدورين يُفرَض على مستوى الـ Controller عبر صلاحية منفصلة
   * (instructor_payouts.approve_second لا يملكها finance_manager). هذا الفحص هنا
   * طبقة حماية إضافية (Defense in Depth) لمنع تطابق نفس الشخص حتى لو أُسندت له الصلاحيتان.
   */
  async secondApproval(payoutId: string, approverId: string) {
    const payout = await this.prisma.instructorPayout.findUniqueOrThrow({ where: { id: payoutId } });

    if (payout.status !== 'pending_second_approval') {
      throw new BadRequestException('هذه الدفعة ليست بانتظار الموافقة الثانية');
    }
    if (payout.firstApprovalById === approverId) {
      throw new ForbiddenException(
        'لا يمكن لنفس الشخص أن يُصادق على الموافقتين الأولى والثانية لنفس الدفعة',
      );
    }

    return this.prisma.instructorPayout.update({
      where: { id: payoutId },
      data: {
        secondApprovalById: approverId,
        secondApprovalAt: new Date(),
        status: 'approved',
      },
    });
  }

  async reject(payoutId: string, reason: string) {
    return this.prisma.instructorPayout.update({
      where: { id: payoutId },
      data: { status: 'rejected', rejectionReason: reason },
    });
  }

  /**
   * ينفَّذ بعد status='approved' فقط. التنفيذ الفعلي (Stripe Connect Transfer /
   * PayPal Payouts API / تحويل بنكي يدوي) يعتمد على
   * instructor_profiles.preferred_payout_method - لم يعد Placeholder بـ console.log.
   */
  async executePayout(payoutId: string) {
    const payout = await this.prisma.instructorPayout.findUniqueOrThrow({ where: { id: payoutId } });
    if (payout.status !== 'approved') {
      throw new BadRequestException('لا يمكن تنفيذ دفعة لم تُعتمَد بعد');
    }

    const profile = await this.prisma.instructorProfile.findUniqueOrThrow({
      where: { userId: payout.instructorId },
    });

    let executionReference: string;
    let payoutMethod = profile.preferredPayoutMethod ?? 'manual_bank_transfer';

    try {
      if (payoutMethod === 'stripe_connect') {
        executionReference = await this.executeStripeConnectTransfer(profile, Number(payout.netAmountUsd));
      } else if (payoutMethod === 'paypal') {
        executionReference = await this.executePayPalPayout(profile, Number(payout.netAmountUsd));
      } else {
        // تحويل بنكي يدوي: لا يوجد API - يبقى بانتظار رفع proof_of_transfer_url
        // يدويًا من الفريق المالي عبر لوحة الإدارة (لا مسار آلي ممكن هنا أصلًا)
        this.logger.warn(
          `دفعة ${payoutId} تتطلب تحويلًا بنكيًا يدويًا - لم يُنفَّذ تلقائيًا، بانتظار تأكيد الفريق المالي`,
        );
        return this.prisma.instructorPayout.update({
          where: { id: payoutId },
          data: { status: 'awaiting_manual_confirmation', payoutMethod },
        });
      }
    } catch (error) {
      this.logger.error(`فشل تنفيذ الدفعة ${payoutId} عبر ${payoutMethod}: ${(error as Error).message}`);
      return this.prisma.instructorPayout.update({
        where: { id: payoutId },
        data: { status: 'failed' },
      });
    }

    return this.prisma.instructorPayout.update({
      where: { id: payoutId },
      data: { status: 'paid', paidAt: new Date(), payoutMethod, executionReference },
    });
  }

  /**
   * Stripe Connect Transfer فعلي - يتطلب أن يكون المدرب قد أكمل Onboarding مسبقًا
   * (stripe_connect_account_id مُسجَّل). يفترض أن رصيد المنصة على Stripe كافٍ
   * (Transfers تُسحَب من رصيد الحساب الرئيسي، وليست Charges منفصلة).
   */
  private async executeStripeConnectTransfer(
    profile: { stripeConnectAccountId: string | null; userId: string },
    amountUsd: number,
  ): Promise<string> {
    if (!profile.stripeConnectAccountId) {
      throw new Error(`لا يملك المدرب ${profile.userId} حساب Stripe Connect مُفعَّلًا بعد`);
    }
    const transfer = await this.stripe.transfers.create({
      amount: Math.round(amountUsd * 100),
      currency: 'usd',
      destination: profile.stripeConnectAccountId,
      description: `دفعة أرباح - منصة Work Study`,
    });
    return transfer.id;
  }

  /**
   * PayPal Payouts API (وليس Orders API المستخدَم لتحصيل المدفوعات - نقطة API
   * مختلفة تمامًا لإرسال أموال للخارج بالجملة/الفردي).
   */
  private async executePayPalPayout(
    profile: { paypalPayoutEmail: string | null; userId: string },
    amountUsd: number,
  ): Promise<string> {
    if (!profile.paypalPayoutEmail) {
      throw new Error(`لا يملك المدرب ${profile.userId} بريد PayPal مُسجَّلًا للاستلام`);
    }

    const baseUrl =
      process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    const tokenResponse = await axios.post(
      `${baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: {
          username: process.env.PAYPAL_CLIENT_ID ?? '',
          password: process.env.PAYPAL_CLIENT_SECRET ?? '',
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const payoutResponse = await axios.post(
      `${baseUrl}/v1/payments/payouts`,
      {
        sender_batch_header: {
          sender_batch_id: `payout_${profile.userId}_${Date.now()}`,
          email_subject: 'دفعة أرباحك من منصة Work Study',
        },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: { value: amountUsd.toFixed(2), currency: 'USD' },
            receiver: profile.paypalPayoutEmail,
            note: 'دفعة أرباح المدرب',
          },
        ],
      },
      { headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` } },
    );

    return payoutResponse.data.batch_header.payout_batch_id;
  }
}
