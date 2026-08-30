import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from './queue-names';

/**
 * يسجّل كل الـ Jobs الدورية (Repeatable Jobs) عند إقلاع التطبيق.
 * BullMQ يخزّن جدول التكرار في Redis نفسه، فالتسجيل هنا idempotent
 * (removeRepeatable قبل add يمنع تراكم Jobs مكررة عند كل إعادة تشغيل للخادم).
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.INSTALLMENTS) private installmentsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EXCHANGE_RATES) private exchangeRatesQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INSTRUCTOR_PAYOUTS) private payoutsQueue: Queue,
  ) {}

  async onModuleInit() {
    // تحصيل الأقساط + فحص التعثر: يوميًا الساعة 02:00 (توقيت الخادم)
    await this.registerRepeatable(
      this.installmentsQueue,
      JOB_NAMES.PROCESS_DUE_INSTALLMENTS,
      '0 2 * * *',
    );

    // تحديث أسعار الصرف: كل 6 ساعات (كما اتُّفق عليه في التصميم المالي)
    await this.registerRepeatable(
      this.exchangeRatesQueue,
      JOB_NAMES.REFRESH_RATES,
      '0 */6 * * *',
    );

    // توليد مستحقات المدربين: يوميًا الساعة 03:00 (بعد Cron تحصيل الأقساط لضمان
    // أن أي أرباح تعثّرت اليوم لا تُحتسب بالخطأ ضمن دفعة هذا اليوم)
    await this.registerRepeatable(
      this.payoutsQueue,
      JOB_NAMES.GENERATE_PAYOUTS,
      '0 3 * * *',
    );

    this.logger.log('تم تسجيل كل الـ Jobs الدورية بنجاح');
  }

  private async registerRepeatable(queue: Queue, jobName: string, cronPattern: string) {
    // إزالة أي جدولة سابقة بنفس الاسم لتفادي التكرار عند كل إعادة تشغيل للخادم
    const existingRepeatable = await queue.getRepeatableJobs();
    for (const job of existingRepeatable) {
      if (job.name === jobName) {
        await queue.removeRepeatableByKey(job.key);
      }
    }

    await queue.add(
      jobName,
      {},
      { repeat: { pattern: cronPattern }, removeOnComplete: 100, removeOnFail: 500 },
    );
    this.logger.log(`Job "${jobName}" مُجدوَل بنمط cron: ${cronPattern}`);
  }
}
