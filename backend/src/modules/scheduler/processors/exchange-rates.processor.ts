import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExchangeRateService } from '../../payments/exchange-rate.service';
import { QUEUE_NAMES } from '../queue-names';

@Processor(QUEUE_NAMES.EXCHANGE_RATES)
export class ExchangeRatesProcessor extends WorkerHost {
  private readonly logger = new Logger(ExchangeRatesProcessor.name);

  constructor(private exchangeRateService: ExchangeRateService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`تنفيذ Job: ${job.name} (${job.id})`);
    await this.exchangeRateService.refreshRatesFromProvider();
    this.logger.log('تم تحديث أسعار الصرف بنجاح');
  }
}
