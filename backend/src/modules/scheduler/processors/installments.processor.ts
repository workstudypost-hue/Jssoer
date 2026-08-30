import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentPlansService } from '../../payments/payment-plans.service';
import { QUEUE_NAMES } from '../queue-names';

@Processor(QUEUE_NAMES.INSTALLMENTS)
export class InstallmentsProcessor extends WorkerHost {
  private readonly logger = new Logger(InstallmentsProcessor.name);

  constructor(private paymentPlansService: PaymentPlansService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`تنفيذ Job: ${job.name} (${job.id})`);
    const result = await this.paymentPlansService.processDueInstallments();
    this.logger.log(
      `اكتملت معالجة الأقساط: ${result.processedCount} قسط، ${result.newlyOverdueCount} أصبح متأخرًا حديثًا`,
    );
    return result;
  }
}
