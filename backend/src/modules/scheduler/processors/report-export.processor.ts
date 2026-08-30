import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReportExportService } from '../../reports/report-export.service';
import { QUEUE_NAMES } from '../queue-names';

@Processor(QUEUE_NAMES.REPORT_EXPORTS)
export class ReportExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportExportProcessor.name);

  constructor(private reportExportService: ReportExportService) {
    super();
  }

  async process(job: Job<{ generatedReportId: string }>): Promise<unknown> {
    this.logger.log(`تصدير تقرير: ${job.data.generatedReportId}`);
    await this.reportExportService.exportReport(job.data.generatedReportId);
    return { done: true };
  }
}
