import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InstructorPayoutsModule } from './modules/instructor-payouts/instructor-payouts.module';
import { CustomRequestsModule } from './modules/custom-requests/custom-requests.module';
import { SecurityReviewModule } from './modules/security-review/security-review.module';
import { VideoSecurityModule } from './modules/video-security/video-security.module';
import { MessagesModule } from './modules/messages/messages.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    // إعدادات البيئة متاحة عالميًا في كل الموديولات
    ConfigModule.forRoot({ isGlobal: true }),

    // حماية عامة من هجمات القوة الغاشمة (Brute-force) على مستوى كل الـ API
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // نافذة 60 ثانية
        limit: 100, // 100 طلب لكل IP كحد افتراضي (يُخصَّص لاحقًا لكل Endpoint حساس مثل OTP)
      },
    ]),

    // اتصال Redis موحّد لكل طوابير BullMQ (Cron الفعلي لتحصيل الأقساط، أسعار الصرف، المستحقات)
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),

    PrismaModule,
    RbacModule,
    UsersModule,
    AuthModule,
    PaymentsModule,
    InstructorPayoutsModule,
    CustomRequestsModule,
    SecurityReviewModule,
    VideoSecurityModule,
    MessagesModule,
    AiGatewayModule,
    ReportsModule,
    SchedulerModule,
  ],
})
export class AppModule {}
