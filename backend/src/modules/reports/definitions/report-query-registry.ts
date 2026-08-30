import { PrismaService } from '../../prisma/prisma.service';

/**
 * سجل الاستعلامات المُعرَّفة مسبقًا (Whitelisted Queries) - كما اتُّفق عليه.
 * لا يوجد أي طريق لبناء SQL من مدخلات المستخدم مباشرة. كل تقرير = دالة TypeScript
 * محدَّدة هنا، والفلاتر تُمرَّر كمعاملات نمطية آمنة عبر Prisma فقط.
 * أي نطاق شخصي (studentId/instructorId) يُحقن دائمًا من الـ JWT session في الخدمة المستدعية،
 * وليس من مدخلات الطلب - راجع reports.service.ts.
 */

export interface ReportContext {
  requesterId: string;
  filters: { dateFrom?: Date; dateTo?: Date; courseId?: string };
}

export const REPORT_QUERIES: Record<string, (prisma: PrismaService, ctx: ReportContext) => Promise<unknown>> = {
  // ---------- أكاديمي: شخصي للطالب فقط ----------
  student_academic_transcript: async (prisma, ctx) => {
    return prisma.enrollment.findMany({
      where: { studentId: ctx.requesterId },
      include: { course: { include: { translations: { where: { locale: 'ar' } } } } },
    });
  },

  // ---------- أكاديمي: للمدرب عن دوراته فقط ----------
  instructor_course_performance: async (prisma, ctx) => {
    const courses = await prisma.course.findMany({
      where: { instructorId: ctx.requesterId },
      include: { enrollments: true, translations: { where: { locale: 'ar' } } },
    });
    return courses.map((c) => ({
      courseId: c.id,
      title: c.translations[0]?.title,
      totalEnrollments: c.enrollments.length,
      avgCompletion:
        c.enrollments.reduce((sum, e) => sum + Number(e.progressPercent), 0) /
        (c.enrollments.length || 1),
    }));
  },

  // ---------- مالي: مدفوعاتي الشخصية (الطالب) ----------
  student_payments_statement: async (prisma, ctx) => {
    return prisma.payment.findMany({
      where: { studentId: ctx.requesterId, createdAt: { gte: ctx.filters.dateFrom, lte: ctx.filters.dateTo } },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ---------- مالي: أرباحي الشخصية (المدرب) ----------
  instructor_earnings_statement: async (prisma, ctx) => {
    return prisma.instructorEarning.findMany({
      where: {
        instructorId: ctx.requesterId,
        createdAt: { gte: ctx.filters.dateFrom, lte: ctx.filters.dateTo },
      },
      include: { payment: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ---------- مالي: إيرادات المنصة الكلية (finance_manager/super_admin فقط) ----------
  platform_revenue_summary: async (prisma, ctx) => {
    const payments = await prisma.payment.findMany({
      where: {
        status: 'completed',
        createdAt: { gte: ctx.filters.dateFrom, lte: ctx.filters.dateTo },
      },
    });
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amountUsd), 0);
    return { totalRevenue, transactionCount: payments.length };
  },

  // ---------- إداري: نمو المستخدمين (marketing/super_admin) ----------
  platform_user_growth: async (prisma, ctx) => {
    const users = await prisma.user.findMany({
      where: { createdAt: { gte: ctx.filters.dateFrom, lte: ctx.filters.dateTo } },
      select: { createdAt: true, isStaff: true, registrationType: true },
    });
    return { newUsersCount: users.length, users };
  },

  // ---------- إداري: مستحقات المدربين المُعلَّقة (Liability Report - finance) ----------
  instructor_payouts_liability: async (prisma, ctx) => {
    const pending = await prisma.instructorEarning.findMany({
      where: { status: { in: ['pending_clearance', 'cleared'] }, payoutId: null },
    });
    const totalLiability = pending.reduce((sum, e) => sum + Number(e.instructorEarningUsd), 0);
    return { totalLiability, instructorCount: new Set(pending.map((e) => e.instructorId)).size };
  },
};
