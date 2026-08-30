import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRateService } from './exchange-rate.service';
import { PaymentGatewayFactory } from './adapters/payment-gateway.factory';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import { InstallmentManagement } from '@prisma/client';

const REFUND_WINDOW_DAYS = 14; // فترة احتجاز أرباح المدرب (كما اتُّفق عليه)
const GRACE_PERIOD_DAYS = 7;   // مهلة السماح عند التعثر (كما اتُّفق عليه - القرار المعتمد)

@Injectable()
export class PaymentPlansService {
  private readonly logger = new Logger(PaymentPlansService.name);

  constructor(
    private prisma: PrismaService,
    private exchangeRateService: ExchangeRateService,
    private gatewayFactory: PaymentGatewayFactory,
    private notifications: NotificationsService,
  ) {}

  /**
   * ينشئ خطة دفع بالتقسيط الداخلي (خصم من بطاقة محفوظة عبر Stripe).
   * لخطط BNPL (Tabby/Tamara) يُستخدم installmentManagement='gateway_managed'
   * والبوابة نفسها تدير الجدولة - هذه الدالة توثّق فقط للعرض في هذه الحالة.
   *
   * القاعدة الأهم: سعر الصرف يُجمَّد هنا لحظة الإنشاء ولا يتغيّر طوال عمر الخطة.
   */
  async createPlan(dto: CreatePaymentPlanDto, studentId: string) {
    const lockedRate = await this.exchangeRateService.getCurrentRate(dto.billingCurrency);
    const billingAmountTotal = dto.totalAmountUsd * lockedRate;
    const installmentAmount = billingAmountTotal / dto.installmentsCount;

    const plan = await this.prisma.paymentPlan.create({
      data: {
        studentId,
        relatedType: dto.relatedType,
        relatedId: dto.relatedId,
        totalAmountUsd: dto.totalAmountUsd,
        billingCurrency: dto.billingCurrency,
        lockedExchangeRate: lockedRate,
        billingAmountTotal,
        installmentsCount: dto.installmentsCount,
        installmentManagement: InstallmentManagement.internal,
        status: 'active',
      },
    });

    // توليد الأقساط الشهرية (تاريخ استحقاق كل قسط = اليوم نفسه من الشهر التالي)
    const installmentsData = Array.from({ length: dto.installmentsCount }, (_, i) => {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      return {
        paymentPlanId: plan.id,
        installmentNumber: i + 1,
        amountBillingCurrency: installmentAmount,
        dueDate,
        status: 'upcoming' as const,
      };
    });

    await this.prisma.installment.createMany({ data: installmentsData });

    return this.prisma.paymentPlan.findUnique({
      where: { id: plan.id },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });
  }

  /**
   * منطق Cron التحصيل اليومي (يُستدعى من InstallmentsScheduler عبر BullMQ).
   * يُطبَّق فقط على installmentManagement='internal' (BNPL تدير نفسها بالكامل).
   * السياسة المعتمدة: مهلة سماح 7 أيام بعد الاستحقاق → ثم حجب جزئي فعلي
   * (enrollment.access_status='restricted' - يحتفظ الطالب بالمحتوى المُكمَل، يُحجب عن الجديد).
   */
  async processDueInstallments() {
    const today = new Date();

    // الأقساط المستحقة اليوم أو سابقًا ولم تُسجَّل كمتأخرة بعد
    const dueInstallments = await this.prisma.installment.findMany({
      where: {
        status: { in: ['upcoming', 'due'] },
        dueDate: { lte: today },
        paymentPlan: { installmentManagement: 'internal', status: 'active' },
      },
      include: { paymentPlan: true },
    });

    for (const installment of dueInstallments) {
      if (installment.status === 'upcoming') {
        await this.prisma.installment.update({
          where: { id: installment.id },
          data: { status: 'due' },
        });
      }

      // محاولة تحصيل فعلية من البطاقة المحفوظة الافتراضية للطالب عبر Stripe -
      // كان هذا سابقًا TODO(production) لعدم توفر بطاقات محفوظة حقيقية؛ الآن مُنفَّذ
      // فعليًا. لا يُعاد المحاولة أكثر من مرة واحدة في نفس تشغيلة الـ Cron لنفس القسط.
      await this.attemptInstallmentCollection(installment);
    }

    // تفعيل مهلة السماح والحجب الجزئي: أقساط 'due' تجاوزت 7 أيام من تاريخ استحقاقها
    const gracePeriodCutoff = new Date();
    gracePeriodCutoff.setDate(gracePeriodCutoff.getDate() - GRACE_PERIOD_DAYS);

    const overdueInstallments = await this.prisma.installment.findMany({
      where: {
        status: 'due',
        dueDate: { lte: gracePeriodCutoff },
        paymentPlan: { installmentManagement: 'internal' },
      },
      include: { paymentPlan: true },
    });

    for (const installment of overdueInstallments) {
      await this.prisma.installment.update({
        where: { id: installment.id },
        data: { status: 'overdue' },
      });

      // الحجب الجزئي الفعلي - يُطبَّق فقط على planTypes المرتبطة بدورة (وليس طلبًا خاصًا)
      const plan = await this.prisma.paymentPlan.findUniqueOrThrow({
        where: { id: installment.paymentPlanId },
      });
      if (plan.relatedType === 'course_enrollment') {
        await this.prisma.enrollment.updateMany({
          where: { studentId: plan.studentId, courseId: plan.relatedId },
          data: { accessStatus: 'restricted' },
        });
      }

      // إشعار الطالب فعليًا بالحجب الجزئي (Fail-Open - فشل الإشعار لا يوقف معالجة
      // بقية الأقساط المتأخرة) + تسجيل نشاط داخلي يظهر في لوحة الفريق المالي
      // (activity_log بدل قناة "finance dashboard" منفصلة غير موجودة أصلًا في هذا
      // الـ Scaffold - نفس مصدر الحقيقة المستخدَم لكل الأحداث الإدارية الأخرى).
      const student = await this.prisma.user.findUnique({ where: { id: plan.studentId } });
      const identifier = student?.email ?? student?.phone;
      if (identifier) {
        const channel = student?.email ? 'email' : 'sms';
        this.notifications
          .sendByChannel(
            channel,
            identifier,
            `تنبيه: القسط المستحق عليك متأخر عن الدفع لأكثر من ${GRACE_PERIOD_DAYS} أيام. تم تقييد الوصول الجزئي لحسابك حتى تسوية المستحقات.`,
          )
          .catch((error) => {
            this.logger.warn(`فشل إرسال إشعار تعثر القسط ${installment.id}: ${(error as Error).message}`);
          });
      }

      await this.prisma.activityLog.create({
        data: {
          actorId: plan.studentId,
          actorRole: 'system',
          action: 'installment.overdue_restriction_applied',
          resourceType: 'installment',
          resourceId: installment.id,
        },
      });
    }

    // الخطة بأكملها تُعتبر 'defaulted' فقط عند تراكم قسطين متأخرين أو أكثر
    // (وليس عند أول تأخير - يتوافق مع كون الحجب "جزئيًا" وليس إنهاءً فوريًا للخطة)
    const planIdsWithOverdue = [...new Set(overdueInstallments.map((i) => i.paymentPlanId))];
    for (const planId of planIdsWithOverdue) {
      const overdueCount = await this.prisma.installment.count({
        where: { paymentPlanId: planId, status: 'overdue' },
      });
      if (overdueCount >= 2) {
        await this.prisma.paymentPlan.update({
          where: { id: planId },
          data: { status: 'defaulted' },
        });
      }
    }

    return {
      processedCount: dueInstallments.length,
      newlyOverdueCount: overdueInstallments.length,
    };
  }

  /**
   * يحاول تحصيل قسط واحد من البطاقة المحفوظة الافتراضية للطالب عبر Stripe
   * (Off-Session). عند النجاح: يُنشأ سجل Payment 'completed' ويُحدَّث القسط 'paid'.
   * عند الفشل (لا بطاقة محفوظة، أو رُفضت، أو تتطلب 3-D Secure تفاعلي): يبقى القسط
   * 'due' ليُعاد تشغيله في اليوم التالي، ويستمر عدّاد مهلة السماح بالعمل بشكل مستقل
   * تمامًا (7 أيام من تاريخ الاستحقاق الأصلي - وليس من تاريخ آخر محاولة).
   */
  private async attemptInstallmentCollection(installment: {
    id: string;
    paymentPlanId: string;
    amountBillingCurrency: unknown;
    paymentPlan: { studentId: string; billingCurrency: string; relatedType: string; relatedId: string };
  }) {
    const savedMethod = await this.prisma.savedPaymentMethod.findFirst({
      where: { studentId: installment.paymentPlan.studentId, isDefault: true },
      include: { gateway: true },
    });

    if (!savedMethod || savedMethod.gateway.provider !== 'stripe') {
      this.logger.warn(
        `لا توجد بطاقة Stripe محفوظة افتراضية للطالب ${installment.paymentPlan.studentId} - تعذَّر تحصيل القسط ${installment.id} تلقائيًا`,
      );
      return;
    }

    const adapter = this.gatewayFactory.getAdapter('stripe');
    if (!adapter.chargeSavedPaymentMethod) return;

    const result = await adapter.chargeSavedPaymentMethod({
      gatewayCustomerId: savedMethod.gatewayCustomerId,
      gatewayPaymentMethodId: savedMethod.gatewayPaymentMethodId,
      amountUsd: Number(installment.amountBillingCurrency),
      currency: installment.paymentPlan.billingCurrency,
      metadata: {
        installmentId: installment.id,
        paymentPlanId: installment.paymentPlanId,
        relatedType: installment.paymentPlan.relatedType,
        relatedId: installment.paymentPlan.relatedId,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        studentId: installment.paymentPlan.studentId,
        relatedType: installment.paymentPlan.relatedType as any,
        relatedId: installment.paymentPlan.relatedId,
        installmentId: installment.id,
        amountUsd: Number(installment.amountBillingCurrency),
        currency: installment.paymentPlan.billingCurrency,
        gatewayId: savedMethod.gatewayId,
        gatewayTransactionId: result.gatewayTransactionId,
        gatewayFeeUsd: result.gatewayFeeUsd,
        gatewayRawResponse: result.rawResponse as any,
        status: result.success ? 'completed' : 'failed',
      },
    });

    if (result.success) {
      await this.prisma.installment.update({
        where: { id: installment.id },
        data: { status: 'paid', paidAt: new Date() },
      });
      this.logger.log(`تم تحصيل القسط ${installment.id} تلقائيًا بنجاح (Payment ${payment.id})`);
    } else {
      this.logger.warn(`فشلت محاولة تحصيل القسط ${installment.id} تلقائيًا - سيُعاد المحاولة غدًا`);
    }
  }
}
