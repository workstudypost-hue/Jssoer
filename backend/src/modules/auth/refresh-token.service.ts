import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

/**
 * إدارة Refresh Tokens بنمط Rotation with Reuse Detection:
 * - كل Refresh Token صالح لاستخدام واحد فقط، وعند استخدامه يُصدَر بديل جديد
 *   بنفس "family_id" ويُبطَل القديم (replacedBy يُشير للجديد).
 * - إن حاول أحد استخدام Token سبق إبطاله (أي: تمت سرقته واستُخدمت نسخة قديمة
 *   بعد أن دار صاحبه Rotation شرعي)، فهذا دليل قوي على سرقة الجلسة →
 *   تُبطَل فورًا كل الـ family بأكملها (كل الأجهزة المرتبطة بهذه السلسلة).
 * نُخزِّن hash فقط للـ Token الخام (SHA-256) - أبدًا القيمة الخام في القاعدة.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private rbac: RbacService,
  ) {}

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** يُستخدم عند تسجيل الدخول الأول (بداية سلسلة/family جديدة تمامًا) */
  async issueNewFamily(
    userId: string,
    deviceId?: string,
    ipAddress?: string,
    userAgent?: string,
    isStaff = false,
  ) {
    const familyId = nanoid();
    return this.issueToken(userId, familyId, deviceId, ipAddress, userAgent, isStaff);
  }

  private async issueToken(
    userId: string,
    familyId: string,
    deviceId?: string,
    ipAddress?: string,
    userAgent?: string,
    isStaff = false,
  ) {
    const roles = await this.rbac.getUserRoleNames(userId);
    const rawRefresh = this.jwtService.sign(
      { sub: userId, roles, familyId, isStaff },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 7));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawRefresh),
        familyId,
        deviceId,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    const accessToken = this.jwtService.sign(
      { sub: userId, roles, isStaff },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      },
    );

    return { accessToken, refreshToken: rawRefresh };
  }

  /**
   * تدوير Token: يتحقق من الصلاحية، يكتشف إعادة الاستخدام الخبيثة، يُصدر زوجًا جديدًا.
   */
  async rotate(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    let payload: { sub: string; familyId: string; isStaff?: boolean };
    try {
      payload = this.jwtService.verify(rawRefreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('رمز التحديث غير صالح أو منتهي الصلاحية');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      throw new UnauthorizedException('رمز التحديث غير معروف');
    }

    if (stored.revokedAt) {
      // إعادة استخدام Token مُبطَل بالفعل = مؤشر سرقة جلسة محتملة
      // → إبطال كل الـ family فورًا كإجراء احترازي (يُسجَّل تلقائيًا عبر revokeFamily)
      await this.revokeFamily(stored.familyId, 'reuse_detected');
      throw new UnauthorizedException(
        'تم رصد استخدام غير طبيعي لجلستك - تم إنهاء كل الجلسات المرتبطة لحمايتك، يُرجى تسجيل الدخول مجددًا',
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('رمز التحديث منتهي الصلاحية');
    }

    const newTokens = await this.issueToken(
      payload.sub,
      payload.familyId,
      stored.deviceId ?? undefined,
      ipAddress,
      userAgent,
      payload.isStaff ?? false,
    );

    const newTokenHash = this.hashToken(newTokens.refreshToken);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: newTokenHash },
    });

    return newTokens;
  }

  async revokeFamily(familyId: string, _reason: 'logout' | 'reuse_detected' | 'manual' = 'manual') {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** تسجيل خروج من جهاز واحد فقط (إبطال family الخاصة بهذا الـ Token دون غيره) */
  async logout(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (stored) {
      await this.revokeFamily(stored.familyId, 'logout');
    }
  }

  /** تسجيل خروج من كل الأجهزة (يُستخدم أيضًا عند تغيير كلمة المرور) */
  async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
