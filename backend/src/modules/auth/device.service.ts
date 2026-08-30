import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';

/**
 * إنفاذ user_devices فعليًا: يمنع تسجيل الدخول المتزامن من أكثر من عدد أجهزة
 * مسموح به (افتراضيًا جهاز واحد للطالب/المدرب، قابل للتوسعة عبر متغير بيئة).
 * السياسة المعتمدة: تسجيل دخول من جهاز جديد بعد تجاوز الحد لا يُرفض تلقائيًا،
 * بل يُنهي أقدم جلسة نشطة (Least-Recently-Used) ويُبقي تجربة المستخدم سلسة -
 * هذا القرار متوافق مع سلوك أغلب منصات SaaS (Netflix-style) بدل حظر صريح مربك.
 */
@Injectable()
export class DeviceService {
  private readonly MAX_ACTIVE_DEVICES = Number(process.env.MAX_ACTIVE_DEVICES_PER_USER ?? 1);

  constructor(private prisma: PrismaService) {}

  async registerDeviceSession(
    userId: string,
    deviceFingerprint: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // إن كان هذا الجهاز نفسه مسجَّلًا مسبقًا (بنفس البصمة)، فقط جدّد الجلسة بدل خلق واحدة جديدة
    const existingSameDevice = await this.prisma.userDevice.findFirst({
      where: { userId, deviceFingerprint, isActive: true },
    });
    if (existingSameDevice) {
      return this.prisma.userDevice.update({
        where: { id: existingSameDevice.id },
        data: { sessionToken: nanoid(32), lastSeenAt: new Date(), ipAddress, userAgent },
      });
    }

    const activeDevices = await this.prisma.userDevice.findMany({
      where: { userId, isActive: true },
      orderBy: { lastSeenAt: 'asc' },
    });

    if (activeDevices.length >= this.MAX_ACTIVE_DEVICES) {
      // إنهاء أقدم الجلسات النشطة حتى يتوفر مكان للجهاز الجديد
      const devicesToDeactivate = activeDevices.slice(
        0,
        activeDevices.length - this.MAX_ACTIVE_DEVICES + 1,
      );
      await this.prisma.userDevice.updateMany({
        where: { id: { in: devicesToDeactivate.map((d) => d.id) } },
        data: { isActive: false },
      });
    }

    return this.prisma.userDevice.create({
      data: {
        userId,
        deviceFingerprint,
        sessionToken: nanoid(32),
        ipAddress,
        userAgent,
      },
    });
  }

  async deactivateSession(sessionToken: string) {
    await this.prisma.userDevice.updateMany({
      where: { sessionToken },
      data: { isActive: false },
    });
  }

  async deactivateAllForUser(userId: string) {
    await this.prisma.userDevice.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
  }
}
