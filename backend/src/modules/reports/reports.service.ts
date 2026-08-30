import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_QUERIES } from './definitions/report-query-registry';
import { QUEUE_NAMES, JOB_NAMES } from '../scheduler/queue-names';

export interface GenerateReportParams {
  reportKey: string;
  requesterId: string;
  requesterRoles: string[];
  filters: { dateFrom?: string; dateTo?: string; courseId?: string };
  exportFormat?: 'json' | 'pdf' | 'xlsx';
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.REPORT_EXPORTS) private exportQueue: Queue,
  ) {}

  async getCatalogForRoles(roles: string[]) {
    return this.prisma.reportDefinition.findMany({
      where: { isActive: true },
    }).then((defs) =>
      defs.filter((d) => (d.applicableRoles as string[]).some((r) => roles.includes(r))),
    );
  }

  async generate(params: GenerateReportParams) {
    const definition = await this.prisma.reportDefinition.findUnique({
      where: { reportKey: params.reportKey },
    });
    if (!definition || !definition.isActive) {
      throw new BadRequestException('التقرير المطلوب غير متاح');
    }

    const exportFormat = params.exportFormat ?? 'json';
    const supportedFormats = definition.supportsExportFormats as string[];
    if (exportFormat !== 'json' && !supportedFormats.includes(exportFormat)) {
      throw new BadRequestException(`صيغة التصدير "${exportFormat}" غير مدعومة لهذا التقرير`);
    }

    const allowedRoles = definition.applicableRoles as string[];
    if (!allowedRoles.some((r) => params.requesterRoles.includes(r))) {
      throw new ForbiddenException('لا تملك صلاحية الوصول لهذا التقرير');
    }

    const queryFn = REPORT_QUERIES[definition.dataSourceQuery];
    if (!queryFn) {
      throw new BadRequestException('استعلام التقرير غير مُعرَّف في السجل الآمن (Whitelisted)');
    }

    // النطاق الشخصي (studentId/instructorId) يُحقن دائمًا من requesterId المُستخرَج من JWT -
    // لا يُقرأ أبدًا من مدخلات الطلب، لمنع أي محاولة لطلب بيانات مستخدم آخر
    const result = await queryFn(this.prisma, {
      requesterId: params.requesterId,
      filters: {
        dateFrom: params.filters.dateFrom ? new Date(params.filters.dateFrom) : undefined,
        dateTo: params.filters.dateTo ? new Date(params.filters.dateTo) : undefined,
        courseId: params.filters.courseId,
      },
    });

    const generatedReport = await this.prisma.generatedReport.create({
      data: {
        reportKey: params.reportKey,
        requestedById: params.requesterId,
        // نُخزِّن نتيجة الاستعلام مؤقتًا ضمن filters (__cachedData) ليقرأها الـ Processor
        // لاحقًا دون إعادة تنفيذ نفس الاستعلام مرتين (تفاديًا لعدم اتساق محتمل إن
        // تغيّرت البيانات بين طلب التقرير وتنفيذ Job التصدير بالخلفية).
        filters: { ...params.filters, exportFormat, __cachedData: exportFormat !== 'json' ? result : undefined } as any,
        scope: 'self',
        status: exportFormat === 'json' ? 'ready' : 'generating',
      },
    });

    if (exportFormat !== 'json') {
      await this.exportQueue.add(JOB_NAMES.EXPORT_REPORT, { generatedReportId: generatedReport.id });
      return { reportId: generatedReport.id, status: 'generating' };
    }

    return { reportId: generatedReport.id, data: result };
  }

  /** يُستخدم من الـ Frontend للـ Polling حتى يجهز الملف (status='ready' مع fileUrl) */
  async getReportStatus(generatedReportId: string, requesterId: string) {
    const report = await this.prisma.generatedReport.findUniqueOrThrow({
      where: { id: generatedReportId },
    });
    if (report.requestedById !== requesterId) {
      throw new ForbiddenException('لا تملك صلاحية الوصول لهذا التقرير');
    }
    return { status: report.status, fileUrl: report.fileUrl, expiresAt: report.expiresAt };
  }
}
