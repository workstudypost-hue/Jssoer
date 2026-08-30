import { BadRequestException, forwardRef, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestTransitionService, TransitionActor } from './state-machine/request-transition.service';
import { CreateCustomRequestDto } from './dto/create-custom-request.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { RespondToPriceDto } from './dto/respond-to-price.dto';
import { AssignInstructorDto } from './dto/assign-instructor.dto';
import { QualityReviewDto } from './dto/reason-note.dto';
import { PaymentsService } from '../payments/payments.service';
import { PaymentPlansService } from '../payments/payment-plans.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class CustomRequestsService {
  constructor(
    private prisma: PrismaService,
    private transitions: RequestTransitionService,
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService: PaymentsService,
    @Inject(forwardRef(() => PaymentPlansService))
    private paymentPlansService: PaymentPlansService,
    private storageService: StorageService,
  ) {}

  // ---------- المرحلة 1: الإنشاء والإرسال (الطالب) ----------

  async create(dto: CreateCustomRequestDto, studentId: string) {
    return this.prisma.customRequest.create({
      data: { studentId, title: dto.title, notes: dto.notes, status: 'draft' },
    });
  }

  /** يُصدر رابط رفع موقَّعًا (Presigned PUT URL) - الملف نفسه لا يمر عبر الـ Backend إطلاقًا */
  async createFileUploadUrl(requestId: string, filename: string, contentType: string, requesterId: string) {
    await this.assertOwnerOrForbidden(requestId, requesterId);
    return this.storageService.generateUploadUrl(requesterId, filename, contentType, 'custom-requests');
  }

  async addFile(requestId: string, fileKey: string, fileType: string, uploadedBy: string) {
    await this.assertOwnerOrForbidden(requestId, uploadedBy);
    // fileUrl هنا يُخزِّن مفتاح الكائن (Object Key) في التخزين وليس رابطًا عامًا مباشرًا -
    // رابط التحميل الفعلي يُولَّد عند الحاجة فقط عبر StorageService.generateDownloadUrl()
    // (راجع getDetails أدناه) حتى لا يبقى أي رابط ثابت طويل الأمد قابلاً للمشاركة.
    return this.prisma.customRequestFile.create({
      data: { requestId, fileUrl: fileKey, fileType, uploadedBy },
    });
  }

  async submit(requestId: string, actor: TransitionActor) {
    const request = await this.prisma.customRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { files: true },
    });
    if (request.files.length === 0) {
      throw new BadRequestException('يجب رفع ملف واحد على الأقل قبل الإرسال');
    }
    if (!request.notes || request.notes.trim().length === 0) {
      throw new BadRequestException('يجب إضافة ملاحظات توضيحية قبل الإرسال');
    }
    return this.transitions.transition(requestId, 'submitted', actor);
  }

  // ---------- المرحلة 2: المراجعة (Staff) ----------

  async listForReview(status?: string) {
    return this.prisma.customRequest.findMany({
      where: status ? { status: status as any } : { status: { in: ['submitted', 'under_review'] } },
      include: { student: { select: { email: true, phone: true } }, files: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getDetails(requestId: string) {
    const request = await this.prisma.customRequest.findUnique({
      where: { id: requestId },
      include: {
        files: true,
        statusLogs: { orderBy: { createdAt: 'asc' } },
        student: { select: { id: true, email: true, phone: true } },
        assignedInstructor: { select: { id: true, email: true } },
      },
    });
    if (!request) throw new NotFoundException('الطلب غير موجود');

    // تحويل كل مفتاح تخزين (Object Key) لرابط تحميل موقَّع مؤقت (15 دقيقة) عند العرض
    // فقط - وليس تخزينه كرابط دائم في القاعدة (راجع addFile أعلاه لسبب هذا القرار).
    const filesWithDownloadUrls = await Promise.all(
      request.files.map(async (file) => ({
        ...file,
        downloadUrl: await this.storageService.generateDownloadUrl(file.fileUrl),
      })),
    );

    return { ...request, files: filesWithDownloadUrls };
  }

  async requestClarification(requestId: string, message: string, actor: TransitionActor) {
    await this.transitions.transition(requestId, 'under_review', actor); // يضمن أنه بدأ المراجعة
    return this.transitions.transition(requestId, 'clarification_needed', actor, message);
  }

  async setPrice(requestId: string, dto: SetPriceDto, actor: TransitionActor) {
    await this.prisma.customRequest.update({
      where: { id: requestId },
      data: {
        proposedPrice: dto.proposedPrice,
        estimatedDeliveryDays: dto.estimatedDeliveryDays,
        reviewedBy: actor.userId,
      },
    });
    await this.transitions.transition(requestId, 'priced', actor, dto.priceBreakdownNotes);
    return this.transitions.transition(requestId, 'awaiting_student_approval', actor);
  }

  async reject(requestId: string, reason: string, actor: TransitionActor) {
    return this.transitions.transition(requestId, 'rejected', actor, reason);
  }

  // ---------- المرحلة 3: موافقة الطالب والدفع ----------

  async respondToPrice(requestId: string, dto: RespondToPriceDto, actor: TransitionActor) {
    if (dto.decision === 'reject') {
      return this.transitions.transition(requestId, 'rejected', actor, 'الطالب رفض السعر المقترح');
    }

    const request = await this.prisma.customRequest.findUniqueOrThrow({ where: { id: requestId } });
    await this.prisma.customRequest.update({
      where: { id: requestId },
      data: { finalPrice: request.proposedPrice },
    });

    // إن اختار الطالب التقسيط، تُنشأ خطة دفع فعلية بـ 3 أقساط شهرية افتراضية
    // (لا يوجد حقل مخصص لعدد الأقساط في هذا النوع من الطلبات بعد - 3 هو الخيار
    // الافتراضي المعقول لطلب خاص، قابل للتوسعة لاحقًا بحقل اختيار صريح من الطالب).
    // يبقى الطلب في awaiting_payment حتى تأكيد أول قسط فعليًا عبر onPaymentConfirmed().
    if (dto.paymentOption === 'installments') {
      await this.paymentPlansService.createPlan(
        {
          relatedType: 'custom_request',
          relatedId: requestId,
          totalAmountUsd: Number(request.proposedPrice),
          billingCurrency: 'USD',
          installmentsCount: 3,
        },
        request.studentId,
      );
    }

    return this.transitions.transition(requestId, 'awaiting_payment', actor);
  }

  /** يُستدعى من Webhook المدفوعات عند تأكيد نجاح أول دفعة/القسط الأول لهذا الطلب */
  async onPaymentConfirmed(requestId: string) {
    const request = await this.prisma.customRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (request.status !== 'awaiting_payment') return; // منع تكرار التنفيذ
    return this.transitions.transition(
      requestId,
      'approved',
      { userId: 'system', roles: ['system'] },
      'تأكيد الدفع تلقائيًا عبر Webhook',
    );
  }

  // ---------- المرحلة 4: الإسناد والإنتاج ----------

  async assign(requestId: string, dto: AssignInstructorDto, actor: TransitionActor) {
    await this.prisma.customRequest.update({
      where: { id: requestId },
      data: { assignedInstructorId: dto.instructorId },
    });
    return this.transitions.transition(requestId, 'assigned', actor);
  }

  async startProduction(requestId: string, actor: TransitionActor) {
    await this.assertAssignedInstructorOrForbidden(requestId, actor.userId);
    return this.transitions.transition(requestId, 'in_production', actor);
  }

  async submitForReview(requestId: string, actor: TransitionActor) {
    await this.assertAssignedInstructorOrForbidden(requestId, actor.userId);
    return this.transitions.transition(requestId, 'in_internal_review', actor);
  }

  // ---------- المرحلة 5: المراجعة الداخلية والتسليم ----------

  async qualityReview(requestId: string, dto: QualityReviewDto, actor: TransitionActor) {
    if (dto.decision === 'approve') {
      return this.transitions.transition(requestId, 'delivered', actor, dto.feedback);
    }
    return this.transitions.transition(requestId, 'revision_requested', actor, dto.feedback);
  }

  async resubmit(requestId: string, actor: TransitionActor) {
    await this.assertAssignedInstructorOrForbidden(requestId, actor.userId);
    return this.transitions.transition(requestId, 'in_internal_review', actor);
  }

  // ---------- المرحلة 6: تأكيد الطالب أو النزاع ----------

  async confirmDelivery(requestId: string, actor: TransitionActor) {
    await this.assertOwnerOrForbidden(requestId, actor.userId);
    const result = await this.transitions.transition(requestId, 'completed', actor);

    // بدء عدّاد clearance_date الفعلي من لحظة تأكيد الطالب تحديدًا - وليس من لحظة
    // الدفع الأولى كما كان يحدث ضمنيًا (عبر createInstructorEarning عند الدفع).
    // للطلبات الخاصة تحديدًا، مخاطر النزاع الحقيقية تُقيَّم بعد التسليم الفعلي
    // وليس عند الدفع (الذي قد يسبق بدء العمل بأسابيع) - لذلك نُعيد ضبط الموعد هنا.
    const REFUND_WINDOW_DAYS = 14;
    const clearanceDate = new Date();
    clearanceDate.setDate(clearanceDate.getDate() + REFUND_WINDOW_DAYS);

    await this.prisma.instructorEarning.updateMany({
      where: { customRequestId: requestId, status: 'pending_clearance' },
      data: { clearanceDate },
    });

    return result;
  }

  async dispute(requestId: string, reason: string, actor: TransitionActor) {
    await this.assertOwnerOrForbidden(requestId, actor.userId);
    return this.transitions.transition(requestId, 'disputed', actor, reason);
  }

  async resolveDispute(
    requestId: string,
    resolution: 'reopen_production' | 'partial_refund' | 'full_refund' | 'mark_completed',
    actor: TransitionActor,
  ) {
    const targetStatus =
      resolution === 'reopen_production' ? 'in_production' : 'completed';

    // استرداد فعلي عبر PaymentsService.initiateRefund() قبل تسجيل الانتقال -
    // إن فشل الاسترداد الفعلي (لا دفعة مكتملة، أو رفضته البوابة)، لا يُسجَّل الانتقال
    // إطلاقًا (fail-fast) بدل ترك الطلب بحالة 'completed' دون استرداد فعلي مطابق.
    if (resolution === 'partial_refund' || resolution === 'full_refund') {
      const request = await this.prisma.customRequest.findUniqueOrThrow({ where: { id: requestId } });
      const fullAmount = Number(request.finalPrice ?? request.proposedPrice ?? 0);
      // ملاحظة: نسبة الاسترداد الجزئي (50%) قيمة افتراضية معقولة غير موثّقة كقرار
      // عمل صريح مسبقًا - يجب مراجعتها وتعديلها فعليًا حسب سياسة النزاعات المعتمدة
      // إداريًا (قد تختلف حسب سبب النزاع)، أو تحويلها لحقل يُدخله المراجع يدويًا.
      const refundAmount = resolution === 'full_refund' ? fullAmount : fullAmount * 0.5;

      if (refundAmount > 0) {
        await this.paymentsService.initiateRefund(
          'custom_request',
          requestId,
          refundAmount,
          `dispute resolution: ${resolution}`,
          actor.userId,
        );
      }
    }

    return this.transitions.transition(requestId, targetStatus, actor, `dispute resolution: ${resolution}`);
  }

  async cancel(requestId: string, actor: TransitionActor) {
    await this.assertOwnerOrForbidden(requestId, actor.userId);
    return this.transitions.transition(requestId, 'cancelled', actor);
  }

  async getTimeline(requestId: string) {
    return this.prisma.customRequestStatusLog.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ---------- Guards داخلية ----------

  private async assertOwnerOrForbidden(requestId: string, userId: string) {
    const request = await this.prisma.customRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (request.studentId !== userId) {
      throw new ForbiddenException('هذا الطلب لا يخصك');
    }
  }

  private async assertAssignedInstructorOrForbidden(requestId: string, userId: string) {
    const request = await this.prisma.customRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (request.assignedInstructorId !== userId) {
      throw new ForbiddenException('هذا الطلب غير مُسنَد إليك');
    }
  }
}
