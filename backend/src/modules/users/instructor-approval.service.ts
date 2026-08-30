import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * يسدّ فجوة كانت موجودة: instructor_profiles.account_status كان يُضبط
 * تلقائيًا على 'active_pending_approval' عند التسجيل الذاتي، لكن لم يكن
 * هناك أي مسار فعلي لإداري ليوافق أو يرفض - المدرب كان سيبقى عالقًا للأبد.
 */
@Injectable()
export class InstructorApprovalService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async listPending() {
    return this.prisma.instructorProfile.findMany({
      where: { accountStatus: 'active_pending_approval' },
      include: { user: { select: { id: true, email: true, phone: true, createdAt: true } } },
    });
  }

  async approve(instructorUserId: string, approverId: string) {
    const profile = await this.prisma.instructorProfile.findUnique({
      where: { userId: instructorUserId },
    });
    if (!profile) throw new NotFoundException('لا يوجد ملف تعريف مدرب لهذا المستخدم');
    if (profile.accountStatus !== 'active_pending_approval') {
      throw new BadRequestException('هذا الحساب ليس بانتظار الموافقة');
    }

    const updated = await this.prisma.instructorProfile.update({
      where: { userId: instructorUserId },
      data: { accountStatus: 'approved', approvedBy: approverId, approvedAt: new Date() },
    });

    await this.prisma.activityLog.create({
      data: {
        actorId: approverId,
        actorRole: 'staff',
        action: 'instructor.approved',
        resourceType: 'instructor_profile',
        resourceId: instructorUserId,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: instructorUserId } });
    const identifier = user?.email ?? user?.phone;
    if (identifier) {
      const channel = user?.email ? 'email' : 'sms';
      await this.notifications.sendByChannel(
        channel,
        identifier,
        'تهانينا! تمت الموافقة على حسابك كمدرب في منصة Work Study. يمكنك الآن البدء بإنشاء دوراتك.',
      );
    }

    return updated;
  }

  async reject(instructorUserId: string, approverId: string, reason?: string) {
    const profile = await this.prisma.instructorProfile.findUnique({
      where: { userId: instructorUserId },
    });
    if (!profile) throw new NotFoundException('لا يوجد ملف تعريف مدرب لهذا المستخدم');
    if (profile.accountStatus !== 'active_pending_approval') {
      throw new BadRequestException('هذا الحساب ليس بانتظار الموافقة');
    }

    const updated = await this.prisma.instructorProfile.update({
      where: { userId: instructorUserId },
      data: { accountStatus: 'rejected' },
    });

    await this.prisma.activityLog.create({
      data: {
        actorId: approverId,
        actorRole: 'staff',
        action: 'instructor.rejected',
        resourceType: 'instructor_profile',
        resourceId: instructorUserId,
        metadata: reason ? { reason } : undefined,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: instructorUserId } });
    const identifier = user?.email ?? user?.phone;
    if (identifier) {
      const channel = user?.email ? 'email' : 'sms';
      const message = reason
        ? `نأسف، لم تتم الموافقة على طلب انضمامك كمدرب. السبب: ${reason}`
        : 'نأسف، لم تتم الموافقة على طلب انضمامك كمدرب في الوقت الحالي.';
      await this.notifications.sendByChannel(channel, identifier, message);
    }

    return updated;
  }
}
