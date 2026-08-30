import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportExportService } from './report-export.service';
import { StorageModule } from '../storage/storage.module';
import { QUEUE_NAMES } from '../scheduler/queue-names';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.REPORT_EXPORTS }), StorageModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportExportService],
  exports: [ReportsService, ReportExportService],
})
export class ReportsModule {}
