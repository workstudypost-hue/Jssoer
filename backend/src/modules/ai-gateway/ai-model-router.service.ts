import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiModelRouterService {
  constructor(private prisma: PrismaService) {}

  /**
   * يقرأ إعدادات التوجيه من DB - لا نموذج مُثبَّت بالكود.
   * كما اتُّفق عليه: Haiku للمهام البسيطة/الحجم الكبير، Sonnet للمتوسطة،
   * Opus للحرجة (بنك الأسئلة، التسعير) - القيم الفعلية تُدار من لوحة الإدارة.
   */
  async getRoutingConfig(featureType: string) {
    const config = await this.prisma.aiModelRouting.findUnique({ where: { featureType } });
    if (!config) {
      throw new Error(`لا يوجد إعداد توجيه لميزة "${featureType}" - أضِفه في ai_model_routing`);
    }
    return config;
  }
}
