import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        preferredLocale: true,
        status: true,
        isStaff: true,
        createdAt: true,
        roles: { select: { role: { select: { name: true } } } },
        instructorProfile: true,
      },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return user;
  }
}
