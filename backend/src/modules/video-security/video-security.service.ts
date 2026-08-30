import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityReviewService } from '../security-review/security-review.service';
import { MuxAdapter } from './mux.adapter';
import { GeoIpService } from './geoip.service';
import { VideoSecurityEventType } from '@prisma/client';

const PLAYBACK_TOKEN_TTL_MINUTES = 5;

// عتبات التصعيد التلقائي للمراجعة البشرية (كما اتُّفق عليه في التصميم)
const DISTINCT_COUNTRIES_THRESHOLD_HIGH = 3; // خلال 24 ساعة
const DEVTOOLS_EVENTS_THRESHOLD_MEDIUM = 5;  // خلال أسبوع

@Injectable()
export class VideoSecurityService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private securityReview: SecurityReviewService,
    private muxAdapter: MuxAdapter,
    private geoIpService: GeoIpService,
  ) {}

  /**
   * بدء جلسة تشغيل: يتحقق من enrollment.access_status='full' أولًا (لن يعمل مع 'restricted'
   * لطالب متعثر عن السداد - كما اتُّفق عليه في سياسة التعثر)، ثم يُصدر playback_token
   * قصير العمر (3-5 دقائق) يُجدَّد عبر Heartbeat، بالإضافة لرابط تشغيل Mux موقَّع
   * (Signed Playback URL) بنفس مدة الصلاحية - المرحلة الأولى من حماية الفيديو
   * (Overlay Watermark + Signed URLs) كما اتُّفق عليه، قبل DRM الكامل لاحقًا.
   */
  async startPlayback(userId: string, lessonId: string, deviceFingerprint: string, ipAddress?: string) {
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: { chapter: { include: { course: true } } },
    });

    if (!lesson.isFreePreview) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: userId, courseId: lesson.chapter.course.id } },
      });
      if (!enrollment || enrollment.accessStatus !== 'full') {
        throw new ForbiddenException(
          'لا تملك وصولًا كاملًا لهذا المحتوى حاليًا (قد يكون بسبب دفعة مستحقة)',
        );
      }
    }

    const playbackToken = this.jwtService.sign(
      { sub: userId, lessonId, deviceFingerprint },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: `${PLAYBACK_TOKEN_TTL_MINUTES}m` },
    );

    const session = await this.prisma.videoPlaybackSession.create({
      data: { userId, lessonId, deviceFingerprint, playbackToken, ipAddress },
    });

    const signedPlaybackUrl = lesson.videoAssetId
      ? this.muxAdapter.generateSignedPlaybackUrl(lesson.videoAssetId, PLAYBACK_TOKEN_TTL_MINUTES, userId)
      : null;

    return {
      sessionId: session.id,
      playbackToken,
      videoAssetId: lesson.videoAssetId,
      signedPlaybackUrl,
      expiresInMinutes: PLAYBACK_TOKEN_TTL_MINUTES,
      // بيانات تُستخدم في الواجهة الأمامية لرسم Watermark ديناميكي فوق الفيديو
      // (اسم/معرِّف المُشاهد + الطابع الزمني) - راجع VideoWatermarkOverlay.tsx
      watermarkPayload: { viewerId: userId, sessionId: session.id },
    };
  }

  /** يُستدعى كل 30 ثانية من الـ Player لتجديد صلاحية الجلسة وإثبات استمرار المشاهدة الشرعية */
  async heartbeat(sessionId: string, userId: string) {
    const session = await this.prisma.videoPlaybackSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { lesson: true },
    });
    if (session.userId !== userId) {
      throw new ForbiddenException('جلسة تشغيل غير صالحة');
    }

    const newToken = this.jwtService.sign(
      { sub: userId, lessonId: session.lessonId, deviceFingerprint: session.deviceFingerprint },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: `${PLAYBACK_TOKEN_TTL_MINUTES}m` },
    );

    await this.prisma.videoPlaybackSession.update({
      where: { id: sessionId },
      data: { lastHeartbeatAt: new Date(), playbackToken: newToken },
    });

    const signedPlaybackUrl = session.lesson.videoAssetId
      ? this.muxAdapter.generateSignedPlaybackUrl(session.lesson.videoAssetId, PLAYBACK_TOKEN_TTL_MINUTES, userId)
      : null;

    return { playbackToken: newToken, signedPlaybackUrl, expiresInMinutes: PLAYBACK_TOKEN_TTL_MINUTES };
  }

  async endPlayback(sessionId: string) {
    return this.prisma.videoPlaybackSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });
  }

  /**
   * يُستدعى من الـ Player عند رصد سلوك مشبوه (DevTools، محاولة تنزيل...).
   * لا يُتخذ أي إجراء فوري - فقط تسجيل، ثم فحص التصعيد التراكمي.
   */
  async reportSecurityEvent(
    userId: string,
    lessonId: string,
    eventType: VideoSecurityEventType,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.videoSecurityEvent.create({
      data: { userId, lessonId, eventType, metadata: metadata as any },
    });

    await this.checkEscalation(userId, eventType);
  }

  /**
   * فحص الأنماط التراكمية وتصعيدها لـ security_review_cases عند تجاوز العتبات -
   * تنبيه فقط للمراجعة البشرية، بدون أي إجراء تلقائي على الحساب (كما اتُّفق عليه).
   */
  private async checkEscalation(userId: string, latestEventType: VideoSecurityEventType) {
    // نمط 1: نفس المستخدم من عدة دول خلال 24 ساعة - يُحسب الآن عبر GeoIpService
    // الفعلي (كان سابقًا يعتمد على عدّ عناوين IP الفريدة كتقريب خام؛ فجوة موثقة
    // في production-notes.md لأن نفس المستخدم قد يُغيِّر IP محليًا دون تغيير دولة
    // فعليًا، مما كان يُنتج تصعيدات كاذبة كثيرة).
    const recentSessions = await this.prisma.videoPlaybackSession.findMany({
      where: { userId, startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { ipAddress: true },
    });

    const distinctCountries = new Set(
      recentSessions
        .map((s) => this.geoIpService.resolveCountry(s.ipAddress))
        .filter((country): country is string => Boolean(country)),
    );

    if (distinctCountries.size >= DISTINCT_COUNTRIES_THRESHOLD_HIGH) {
      await this.securityReview.createCase({
        userId,
        caseType: 'multi_region_access',
        severity: 'high',
        relatedEvents: { distinctCountries: Array.from(distinctCountries) },
      });
      return;
    }

    // نمط 2: تكرار محاولات DevTools خلال أسبوع
    if (latestEventType === 'devtools_opened') {
      const weeklyCount = await this.prisma.videoSecurityEvent.count({
        where: {
          userId,
          eventType: 'devtools_opened',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });
      if (weeklyCount >= DEVTOOLS_EVENTS_THRESHOLD_MEDIUM) {
        await this.securityReview.createCase({
          userId,
          caseType: 'repeated_devtools_detection',
          severity: 'medium',
          relatedEvents: { weeklyCount },
        });
      }
    }
  }
}
