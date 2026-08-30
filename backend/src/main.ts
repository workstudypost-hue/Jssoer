import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

const STRIPE_WEBHOOK_PATH = '/api/v1/webhooks/payments/stripe';

async function bootstrap() {
  // bodyParser: false إلزامي هنا - نُطبِّق التحليل يدويًا أدناه بالترتيب الصحيح،
  // لأن Nest يُطبِّق express.json() تلقائيًا وبأسبقية أعلى من أي middleware نضيفه
  // لاحقًا على app، مما يمنع وصول الـ body الخام لمسار Stripe webhook قبل هذا الإصلاح.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // مسار Stripe webhook تحديدًا يحتاج الـ body الخام (Buffer) لحساب توقيع HMAC بدقة -
  // يجب تسجيله قبل express.json() العام وإلا سيُحلَّل الـ body مبكرًا ويفشل التحقق دائمًا.
  app.use(STRIPE_WEBHOOK_PATH, express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // أمان أساسي على مستوى الـ HTTP headers
  app.use(helmet());

  // تفعيل CORS محصور بنطاق الـ Frontend فقط
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // بادئة موحّدة لكل الـ API (كما صُمم في وثائق الـ Endpoints)
  app.setGlobalPrefix('api/v1');

  // التحقق التلقائي من كل DTO الوارد + رفض أي حقول غير معرّفة
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api/v1`);
}
bootstrap();
