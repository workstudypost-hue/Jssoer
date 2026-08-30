import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGatewayFactory } from './adapters/payment-gateway.factory';
import { GatewayProvider, PaymentPlanRelatedType } from '@prisma/client';
import { CustomRequestsService } from '../custom-requests/custom-requests.service';

const REFUND_WINDOW_DAYS = 14;

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private gatewayFactory: PaymentGatewayFactory,
    @Inject(forwardRef(() => CustomRequestsService))
    private customRequestsService: CustomRequestsService,
  ) {}

  /** ينشئ جلسة دفع عبر البوابة المختارة (بطاقة كاملة، أو قسط، حسب السياق) */
  async initiatePayment(params: {
    studentId: string;
    amountUsd: number;
    currency: string;
    provider: GatewayProvider;
    relatedType: PaymentPlanRelatedType;
    relatedId: string;
    installmentId?: string;
  }) {
    const gateway = await this.prisma.paymentGateway.findUnique({
      where: { provider: params.provider },
    });
    if (!gateway || !gateway.isActive) {
      throw new BadRequestException('بوابة الدفع المطلوبة غير متاحة حاليًا');
    }

    const adapter = this.gatewayFactory.getAdapter(params.provider);
    const session = await adapter.createPaymentIntent({
      amountUsd: params.amountUsd,
      currency: params.currency,
      studentId: params.studentId,
      metadata: {
        relatedType: params.relatedType,
        relatedId: params.relatedId,
        installmentId: params.installmentId ?? '',
      },
    });

    await this.prisma.payment.create({
      data: {
        studentId: params.studentId,
        relatedType: params.relatedType,
        relatedId: params.relatedId,
        installmentId: params.installmentId,
        amountUsd: params.amountUsd,
        currency: params.currency,
        gatewayId: gateway.id,
        gatewayTransactionId: session.sessionId,
        status: 'pending',
      },
    });

    return session;
  }

  /**
   * يُستدعى من Webhook Controller عند تأكيد نجاح الدفع من البوابة.
   * هذه هي النقطة الوحيدة التي تُعتبر فيها الدفعة "ناجحة فعليًا" -
   * ليس عند استجابة الـ API الأولية، بل عند تأكيد الـ Webhook.
   */
  async confirmPaymentSuccess(gatewayTransactionId: string, provider: GatewayProvider) {
    const adapter = this.gatewayFactory.getAdapter(provider);
    const result = await adapter.capturePayment(gatewayTransactionId);

    const payment = await this.prisma.payment.findFirst({
      where: { gatewayTransactionId },
    });
    if (!payment) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: result.success ? 'completed' : 'failed',
        gatewayFeeUsd: result.gatewayFeeUsd,
        gatewayRawResponse: result.rawResponse as any,
      },
    });

    if (payment.installmentId) {
      await this.prisma.installment.update({
        where: { id: payment.installmentId },
        data: { status: result.success ? 'paid' : 'failed', paidAt: result.success ? new Date() : undefined },
      });
    }

    // إن كانت الدفعة مرتبطة بدورة أو بطلب خاص، تُنشأ حصة المدرب تلقائيًا لكلتيهما -
    // كان سابقًا مفعّلًا لـ course_enrollment فقط (فجوة حقيقية موثقة في production-notes.md)
    if (result.success && (payment.relatedType === 'course_enrollment' || payment.relatedType === 'custom_request')) {
      await this.createInstructorEarning(payment.id, result.gatewayFeeUsd);
    }

    // ربط فعلي بمحرك حالة الطلبات الخاصة - كان موصوفًا وجاهزًا لكن غير مُستدعى تلقائيًا
    // (فجوة موثقة في production-notes.md) - ينقل الطلب من awaiting_payment إلى approved
    if (result.success && payment.relatedType === 'custom_request') {
      await this.customRequestsService.onPaymentConfirmed(payment.relatedId);
    }
  }

  /** يُستدعى عند فشل الدفع فعليًا من طرف البوابة (وليس فقط عدم استجابة الطالب) */
  async confirmPaymentFailure(gatewayTransactionId: string, provider: GatewayProvider) {
    const payment = await this.prisma.payment.findFirst({ where: { gatewayTransactionId } });
    if (!payment) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });

    if (payment.installmentId) {
      await this.prisma.installment.update({
        where: { id: payment.installmentId },
        data: { status: 'failed' },
      });
    }
  }

  /** يُستدعى عند تأكيد اكتمال استرداد من طرف البوابة (وليس فقط طلب الاسترداد من الإدارة) */
  async confirmRefundCompleted(gatewayTransactionId: string, provider: GatewayProvider) {
    const payment = await this.prisma.payment.findFirst({ where: { gatewayTransactionId } });
    if (!payment) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded' },
    });

    await this.prisma.refund.updateMany({
      where: { paymentId: payment.id, status: { in: ['requested', 'approved'] } },
      data: { status: 'completed' },
    });

    // إلغاء حصة المدرب المرتبطة إن كانت لا تزال قيد الاستحقاق (لم تُصرَف بعد)
    const earning = await this.prisma.instructorEarning.findUnique({ where: { paymentId: payment.id } });
    if (earning && earning.status === 'pending_clearance') {
      await this.prisma.instructorEarning.update({
        where: { paymentId: payment.id },
        data: { status: 'clawed_back' },
      });
    }
  }

  /**
   * يترجم معادلة الاحتساب المتفق عليها بدقة:
   * gross → خصم عمولة البوابة أولًا → تقسيم الصافي بين المدرب والمنصة حسب النسبة الفعّالة.
   * يدعم الآن كلا نوعي related_type (كان مفعّلًا لـ course_enrollment فقط سابقًا - فجوة
   * موثقة في production-notes.md: custom_request كانت لا تُنشئ حصة مدرب إطلاقًا).
   */
  private async createInstructorEarning(paymentId: string, gatewayFeeUsd: number) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const netAfterGateway = Number(payment.amountUsd) - gatewayFeeUsd;
    const clearanceDate = new Date();
    clearanceDate.setDate(clearanceDate.getDate() + REFUND_WINDOW_DAYS);

    if (payment.relatedType === 'course_enrollment') {
      const course = await this.prisma.course.findUnique({ where: { id: payment.relatedId } });
      if (!course) return;

      const commissionPercent = await this.resolveCommissionPercent(
        course.instructorId,
        course.id,
        course.level,
      );
      const instructorEarningUsd = netAfterGateway * (commissionPercent / 100);

      await this.prisma.instructorEarning.create({
        data: {
          instructorId: course.instructorId,
          paymentId: payment.id,
          courseId: course.id,
          grossAmountUsd: payment.amountUsd,
          gatewayFeeUsd,
          netAfterGatewayUsd: netAfterGateway,
          commissionPercentApplied: commissionPercent,
          instructorEarningUsd,
          platformFeeUsd: netAfterGateway - instructorEarningUsd,
          status: 'pending_clearance',
          clearanceDate,
        },
      });
      return;
    }

    if (payment.relatedType === 'custom_request') {
      const request = await this.prisma.customRequest.findUnique({ where: { id: payment.relatedId } });
      if (!request || !request.assignedInstructorId) return;

      // لا يوجد "مستوى دورة" لطلب مخصص - نعتمد اتفاقية المدرب العامة، وإلا سياسة
      // افتراضية مخصصة لهذا النوع من الطلبات (professional كمستوى مرجعي افتراضي)
      const commissionPercent = await this.resolveCommissionPercent(
        request.assignedInstructorId,
        null,
        'professional',
      );
      const instructorEarningUsd = netAfterGateway * (commissionPercent / 100);

      await this.prisma.instructorEarning.create({
        data: {
          instructorId: request.assignedInstructorId,
          paymentId: payment.id,
          customRequestId: request.id,
          grossAmountUsd: payment.amountUsd,
          gatewayFeeUsd,
          netAfterGatewayUsd: netAfterGateway,
          commissionPercentApplied: commissionPercent,
          instructorEarningUsd,
          platformFeeUsd: netAfterGateway - instructorEarningUsd,
          status: 'pending_clearance',
          clearanceDate,
        },
      });
    }
  }

  /**
   * أولوية تحديد النسبة كما اتُّفق عليه:
   * 1. اتفاقية خاصة بالمدرب + الدورة   2. اتفاقية عامة للمدرب   3. السياسة الافتراضية لمستوى الدورة
   */
  private async resolveCommissionPercent(
    instructorId: string,
    courseId: string | null,
    courseLevel: string,
  ): Promise<number> {
    if (courseId) {
      const specificAgreement = await this.prisma.instructorCommissionAgreement.findFirst({
        where: { instructorId, courseId, status: 'active' },
      });
      if (specificAgreement) return Number(specificAgreement.instructorSharePercent);
    }

    const generalAgreement = await this.prisma.instructorCommissionAgreement.findFirst({
      where: { instructorId, courseId: null, status: 'active' },
    });
    if (generalAgreement) return Number(generalAgreement.instructorSharePercent);

    const defaultPolicy = await this.prisma.commissionPolicy.findFirst({
      where: { courseLevel: courseLevel as any, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!defaultPolicy) {
      throw new BadRequestException('لا توجد سياسة عمولة مُعرَّفة لهذا المستوى من الدورات');
    }
    return Number(defaultPolicy.instructorSharePercent);
  }

  /**
   * يبدأ استردادًا فعليًا: يجد آخر دفعة ناجحة مرتبطة بالمورد (course_enrollment أو
   * custom_request)، يستدعي adapter.refund() الحقيقي عبر البوابة الأصلية نفسها التي
   * تمت بها الدفعة، ويُنشئ سجل Refund بالحالة الفعلية المُرجعة من البوابة.
   * لا يفترض النجاح أبدًا قبل تأكيد الـ Webhook (`confirmRefundCompleted`) - الحالة
   * الأولية هنا 'requested' أو 'processing' حسب استجابة البوابة الفورية فقط.
   */
  async initiateRefund(
    relatedType: PaymentPlanRelatedType,
    relatedId: string,
    amountUsd: number,
    reason: string,
    processedBy: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { relatedType, relatedId, status: 'completed' },
      include: { gateway: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      throw new BadRequestException('لا توجد دفعة مكتملة مرتبطة بهذا الطلب لاسترداد مبلغها');
    }
    if (!payment.gatewayTransactionId) {
      throw new BadRequestException('لا يوجد معرِّف معاملة صالح لدى البوابة لتنفيذ الاسترداد');
    }

    const adapter = this.gatewayFactory.getAdapter(payment.gateway.provider);
    const result = await adapter.refund(payment.gatewayTransactionId, amountUsd);

    const refund = await this.prisma.refund.create({
      data: {
        paymentId: payment.id,
        amountUsd,
        reason,
        processedBy,
        status: result.success ? 'approved' : 'requested',
      },
    });

    // بعض البوابات (Stripe) تُرجع نجاحًا فوريًا مؤكدًا وليس فقط عبر Webhook لاحق -
    // في هذه الحالة نُحدِّث حالة الدفعة فورًا بدل انتظار webhook قد يتأخر
    if (result.success) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } });
    }

    return refund;
  }
}
