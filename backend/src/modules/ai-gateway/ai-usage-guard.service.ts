import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiUserRole } from '@prisma/client';

/**
 * يفرض حدود الاستخدام كما اتُّفق عليه: مرنة بالكامل من لوحة الإدارة، لا أرقام ثابتة بالكود.
 * الأولوية: ai_usage_limit_overrides (استثناء فردي سارٍ) > ai_usage_limits الافتراضي للدور.
 */
@Injectable()
export class AiUsageGuardService {
  constructor(private prisma: PrismaService) {}

  async checkAndIncrement(userId: string, role: AiUserRole, featureType: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const override = await this.prisma.aiUsageLimitOverride.findFirst({
      where: {
        userId,
        featureType,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const dailyLimit = override?.customDailyLimit
      ?? (await this.prisma.aiUsageLimit.findUnique({
        where: { role_featureType: { role, featureType } },
      }))?.dailyRequestLimit;

    if (dailyLimit != null) {
      const tracking = await this.prisma.aiUsageTracking.findUnique({
        where: { userId_date: { userId, date: today } },
      });
      if (tracking && tracking.requestsCount >= dailyLimit) {
        throw new BadRequestException(
          `وصلت للحد اليومي لهذه الميزة (${dailyLimit} طلب). سيُعاد تعيينه منتصف الليل.`,
        );
      }
    }

    await this.prisma.aiUsageTracking.upsert({
      where: { userId_date: { userId, date: today } },
      update: { requestsCount: { increment: 1 } },
      create: { userId, date: today, requestsCount: 1 },
    });
  }

  async recordTokenUsage(userId: string, tokens: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.aiUsageTracking.upsert({
      where: { userId_date: { userId, date: today } },
      update: { tokensConsumed: { increment: tokens } },
      create: { userId, date: today, tokensConsumed: tokens, requestsCount: 0 },
    });
  }
}
