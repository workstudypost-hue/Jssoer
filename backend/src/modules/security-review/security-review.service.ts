import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityCaseType, SecurityCaseSeverity, SecurityCaseResolution } from '@prisma/client';

/**
 * لوحة "مراجعة الأمان" الموحّدة - كما اتُّفق عليه، تخدم كل أنواع الاشتباه
 * (تسريب فيديو، مشاركة حساب، محاولات تواصل خارجي) بنفس الآلية:
 * تنبيه بشري فقط، بدون أي إجراء تلقائي على حساب المستخدم.
 * القرار النهائي الحساس (تعليق حساب) دائمًا صلاحية super_admin حصريًا.
 */
@Injectable()
export class SecurityReviewService {
  constructor(private prisma: PrismaService) {}

  async createCase(params: {
    userId: string;
    caseType: SecurityCaseType;
    severity: SecurityCaseSeverity;
    relatedEvents?: unknown;
  }) {
    return this.prisma.securityReviewCase.create({
      data: {
        userId: params.userId,
        caseType: params.caseType,
        severity: params.severity,
        relatedEvents: params.relatedEvents as any,
        status: 'open',
      },
    });
  }

  async listQueue(filters: { caseType?: SecurityCaseType; status?: string }) {
    return this.prisma.securityReviewCase.findMany({
      where: {
        caseType: filters.caseType,
        status: (filters.status as any) ?? { in: ['open', 'under_review'] },
      },
      include: { user: { select: { email: true, phone: true } } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async assign(caseId: string, assigneeId: string) {
    return this.prisma.securityReviewCase.update({
      where: { id: caseId },
      data: { assignedToId: assigneeId, status: 'under_review' },
    });
  }

  /**
   * إغلاق الحالة. resolution='account_suspended' يُوثَّق هنا فقط كتوصية/سجل -
   * التنفيذ الفعلي لتعليق الحساب يبقى إجراءً منفصلاً يتطلب صلاحية users.suspend
   * (super_admin حصريًا)، وليس جزءًا تلقائيًا من هذه الدالة.
   */
  async resolve(caseId: string, resolution: SecurityCaseResolution, notes: string, resolvedBy: string) {
    return this.prisma.securityReviewCase.update({
      where: { id: caseId },
      data: {
        status: resolution === 'false_positive' ? 'dismissed' : 'action_taken',
        resolution,
        reviewerNotes: notes,
        resolvedBy,
        resolvedAt: new Date(),
      },
    });
  }
}
