import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulerService } from './scheduler.service';
import { InstallmentsProcessor } from './processors/installments.processor';
import { ExchangeRatesProcessor } from './processors/exchange-rates.processor';
import { InstructorPayoutsProcessor } from './processors/instructor-payouts.processor';
import { ReportExportProcessor } from './processors/report-export.processor';
import { QUEUE_NAMES } from './queue-names';
import { PaymentsModule } from '../payments/payments.module';
import { InstructorPayoutsModule } from '../instructor-payouts/instructor-payouts.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.INSTALLMENTS },
      { name: QUEUE_NAMES.EXCHANGE_RATES },
      { name: QUEUE_NAMES.INSTRUCTOR_PAYOUTS },
      { name: QUEUE_NAMES.REPORT_EXPORTS },
    ),
    // نحتاج الخدمات الفعلية (PaymentPlansService, ExchangeRateService, InstructorPayoutsService,
    // ReportExportService) لحقنها داخل الـ Processors - كلها exports من موديولاتها الأصلية مسبقًا
    PaymentsModule,
    InstructorPayoutsModule,
    ReportsModule,
  ],
  providers: [
    SchedulerService,
    InstallmentsProcessor,
    ExchangeRatesProcessor,
    InstructorPayoutsProcessor,
    ReportExportProcessor,
  ],
})
export class SchedulerModule {}
