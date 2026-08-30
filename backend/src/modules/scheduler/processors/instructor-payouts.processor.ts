import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InstructorPayoutsService } from '../../instructor-payouts/instructor-payouts.service';
import { QUEUE_NAMES } from '../queue-names';

@Processor(QUEUE_NAMES.INSTRUCTOR_PAYOUTS)
export class InstructorPayoutsProcessor extends WorkerHost {
  private readonly logger = new Logger(InstructorPayoutsProcessor.name);

  constructor(private payoutsService: InstructorPayoutsService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`تنفيذ Job: ${job.name} (${job.id})`);
    const result = await this.payoutsService.generateDuePayouts();
    this.logger.log(`تم توليد ${result.generatedPayoutIds.length} دفعة مستحقات جديدة`);
    return result;
  }
}
