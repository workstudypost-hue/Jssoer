import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma Service مركزي — يُحقن في أي Service يحتاج الوصول لقاعدة البيانات.
 * لاحقًا: يمكن توسيعه لدعم Read Replica منفصلة لخدمة التقارير
 * (كما صُمم في نظام التقارير: Production DB مقابل Reporting Replica)
 *
 * يستخدم Driver Adapter (`@prisma/adapter-pg`) بدل الاتصال الافتراضي عبر Query Engine
 * الثنائي - هذا يعني عدم الحاجة لتحميل أي ملف ثنائي (.so/.dll) من binaries.prisma.sh
 * إطلاقًا عند `npm install`/`prisma generate`، وهو ما كان يفشل سابقًا خلف أي شبكة
 * مقيَّدة (جدار حماية مؤسسي، بيئات CI بلا وصول خارجي). الاتصال الفعلي يتم عبر
 * حزمة `pg` القياسية المفتوحة المصدر مباشرة.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
