import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CustomRequestStatus } from '@prisma/client';

export interface TransitionActor {
  userId: string;
  roles: string[];
}

/**
 * رسائل الإشعار لكل حالة وصول (toStatus) - بالعربية دائمًا حاليًا (المنصة عربية
 * أولًا). لم تُضَف كجدول DB منفصل (notification_triggers) تفاديًا لـ migration
 * إضافية غير ضرورية الآن؛ يمكن نقلها لاحقًا لجدول قابل للتعديل من لوحة الإدارة
 * إن احتاجت الإدارة تخصيص النصوص دون نشر كود جديد.
 */
const TRANSITION_NOTIFICATION_MESSAGES: Partial<Record<CustomRequestStatus, string>> = {
  submitted: 'تم استلام طلبك الخاص وهو الآن قيد المراجعة من فريقنا.',
  price_proposed: 'تم تحديد سعر مقترح لطلبك الخاص - يُرجى مراجعته والموافقة عليه.',
  awaiting_payment: 'وافق المدرب على السعر - أكمل الدفع الآن لبدء العمل على طلبك.',
  approved: 'تم تأكيد الدفع بنجاح، طلبك الخاص الآن قيد التنفيذ.',
  in_production: 'بدأ المدرب العمل فعليًا على طلبك الخاص.',
  delivered: 'تم تسليم طلبك الخاص - يُرجى مراجعته والموافقة عليه أو طلب تعديل.',
  disputed: 'تم فتح نزاع على طلبك الخاص وهو الآن قيد المراجعة الإدارية.',
  completed: 'اكتمل طلبك الخاص بنجاح. شكرًا لاستخدامك المنصة!',
  cancelled: 'تم إلغاء طلبك الخاص.',
};

@Injectable()
export class RequestTransitionService {
  private readonly logger = new Logger(RequestTransitionService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async transition(
    requestId: string,
    toStatus: CustomRequestStatus,
    actor: TransitionActor,
    note?: string,
  ) {
    const request = await this.prisma.customRequest.findUniqueOrThrow({
      where: { id: requestId },
    });

    const rule = await this.prisma.requestStatusTransition.findUnique({
      where: { fromStatus_toStatus: { fromStatus: request.status, toStatus } },
    });

    if (!rule) {
      throw new BadRequestException(
        `انتقال غير مسموح: من "${request.status}" إلى "${toStatus}"`,
      );
    }

    const allowedRoles = rule.allowedRoles as string[];
    const isOwner = request.studentId === actor.userId;
    const isAssignedInstructor = request.assignedInstructorId === actor.userId;

    // 'self' في allowed_roles تعني: صاحب الطلب نفسه (الطالب) أو المدرب المُسند تحديدًا
    const hasRoleAccess = allowedRoles.some((r) => actor.roles.includes(r));
    const hasSelfAccess =
      allowedRoles.includes('self') && (isOwner || isAssignedInstructor);

    if (!hasRoleAccess && !hasSelfAccess) {
      throw new ForbiddenException('لا تملك الصلاحية لتنفيذ هذا الانتقال');
    }

    // الشروط المسبقة الإضافية (مثال: 'payment_confirmed' قبل الانتقال لـ approved)
    if (rule.requiresCondition) {
      const conditionMet = await this.checkCondition(rule.requiresCondition, request);
      if (!conditionMet) {
        throw new BadRequestException(`الشرط المسبق غير مكتمل: ${rule.requiresCondition}`);
      }
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.customRequest.update({
        where: { id: requestId },
        data: { status: toStatus },
      }),
      this.prisma.customRequestStatusLog.create({
        data: {
          requestId,
          fromStatus: request.status,
          toStatus,
          changedBy: actor.userId,
          note,
        },
      }),
    ]);

    // إشعار تلقائي للطالب بكل انتقال حالة يهمّه - مبني على جدول ثابت بالكود
    // (TRANSITION_NOTIFICATION_MESSAGES) بدل تمرير صامت كامل كما كان سابقًا.
    // فشل الإشعار لا يُفشل الانتقال نفسه (Fail-Open - الحالة أهم من الإشعار).
    const notificationMessage = TRANSITION_NOTIFICATION_MESSAGES[toStatus];
    if (notificationMessage) {
      const student = await this.prisma.user.findUnique({ where: { id: request.studentId } });
      const identifier = student?.email ?? student?.phone;
      if (identifier) {
        const channel = student?.email ? 'email' : 'sms';
        this.notifications.sendByChannel(channel, identifier, notificationMessage).catch((error) => {
          this.logger.warn(`فشل إرسال إشعار انتقال الطلب ${requestId}: ${(error as Error).message}`);
        });
      }
    }

    return updated;
  }

  private async checkCondition(condition: string, request: { id: string; finalPrice: any }): Promise<boolean> {
    switch (condition) {
      case 'has_price_set':
        return request.finalPrice !== null;
      case 'payment_confirmed': {
        const completedPayment = await this.prisma.payment.findFirst({
          where: { relatedType: 'custom_request', relatedId: request.id, status: 'completed' },
        });
        return Boolean(completedPayment);
      }
      default:
        return true;
    }
  }
}
