import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityReviewService } from '../security-review/security-review.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { SendMessageDto } from './dto/send-message.dto';
import { runRegexDetection, maskDetectedContent } from './detection/regex-detector';
import { AiUserRole } from '@prisma/client';

// تصعيد تراكمي (Progressive Enforcement) كما اتُّفق عليه - لا عقاب على مخالفة واحدة بريئة
const WARNING_THRESHOLD = 3;
const ESCALATION_THRESHOLD = 5;
const VIOLATION_WINDOW_DAYS = 30;

export type SendMessageResult =
  | { status: 'sent'; message: unknown }
  | { status: 'sent_flagged'; message: unknown }
  | { status: 'blocked'; reason: string };

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private securityReview: SecurityReviewService,
    private aiGateway: AiGatewayService,
  ) {}

  async send(dto: SendMessageDto, senderId: string, senderIsStaff: boolean): Promise<SendMessageResult> {
    // قناة الدعم لموظف موثَّق: فحص أخف (الدعم قد يشارك روابط رسمية شرعيًا)
    if (dto.contextType === 'support_ticket' && senderIsStaff) {
      const message = await this.prisma.message.create({
        data: {
          threadId: dto.threadId,
          senderId,
          contextType: dto.contextType,
          contextId: dto.contextId,
          rawContent: dto.content,
          moderationStatus: 'clean',
          senderIsStaff: true,
        },
      });
      return { status: 'sent', message };
    }

    const detection = runRegexDetection(dto.content);

    // Layer 1: ثقة عالية (رقم/بريد صريح) → حظر فوري بدون استدعاء AI
    if (detection.matched && detection.confidence === 'high') {
      await this.recordViolation(senderId, detection.patterns.join(','), 'high', 'message_blocked');
      return {
        status: 'blocked',
        reason: 'رسالتك تحتوي معلومات تواصل خارجية وهذا مخالف لسياسة المنصة',
      };
    }

    // ثقة متوسطة: إخفاء الجزء المشبوه + تصعيد للمراجعة البشرية
    if (detection.matched && detection.confidence === 'medium') {
      const sanitized = maskDetectedContent(dto.content);
      const message = await this.prisma.message.create({
        data: {
          threadId: dto.threadId,
          senderId,
          contextType: dto.contextType,
          contextId: dto.contextId,
          rawContent: dto.content,
          sanitizedContent: sanitized,
          moderationStatus: 'flagged',
          detectionLayer: 'regex',
          detectedPatterns: detection.patterns,
        },
      });
      await this.recordViolation(senderId, detection.patterns.join(','), 'medium', 'content_masked');
      return { status: 'sent_flagged', message };
    }

    // ثقة منخفضة (كلمات سياقية فقط، مثل "تواصل معي" أو أرقام مموَّهة بكلمات):
    // Layer 2 عبر AI Gateway (Haiku - رخيص وسريع) للتصنيف السياقي الدقيق قبل القرار.
    // هذا كان TODO(production) صريحًا؛ الآن مُفعَّل فعليًا بدل المرور الصامت الكامل.
    if (detection.matched && detection.confidence === 'low') {
      const aiVerdict = await this.classifyWithAi(dto.content, senderId);

      if (aiVerdict?.isLeakAttempt) {
        const sanitized = maskDetectedContent(dto.content);
        const message = await this.prisma.message.create({
          data: {
            threadId: dto.threadId,
            senderId,
            contextType: dto.contextType,
            contextId: dto.contextId,
            rawContent: dto.content,
            sanitizedContent: sanitized,
            moderationStatus: 'flagged',
            detectionLayer: 'ai_contextual',
            detectedPatterns: detection.patterns,
          },
        });
        await this.recordViolation(senderId, `ai_detected:${detection.patterns.join(',')}`, 'medium', 'content_masked');
        return { status: 'sent_flagged', message };
      }
      // AI قرَّر أنها ليست محاولة تسريب فعلية (سياق بريء) → تمر مع تسجيل صامت فقط
    }

    const message = await this.prisma.message.create({
      data: {
        threadId: dto.threadId,
        senderId,
        contextType: dto.contextType,
        contextId: dto.contextId,
        rawContent: dto.content,
        moderationStatus: detection.matched ? 'flagged' : 'clean',
        detectionLayer: detection.matched ? 'regex' : undefined,
        detectedPatterns: detection.matched ? detection.patterns : undefined,
      },
    });

    return { status: 'sent', message };
  }

  /**
   * تصنيف Layer 2 عبر AI Gateway: يُرسِل النص فقط (بدون أي بيانات هوية) لنموذج
   * Haiku الرخيص، ويطلب حكمًا ثنائيًا صارمًا بصيغة JSON. عند أي خطأ (فشل الشبكة،
   * تعذُّر تحليل JSON) نعتبرها "لا داعي للتصعيد" افتراضيًا (Fail-Open) بدل حظر
   * رسائل بريئة بسبب عطل تقني - يتوافق مع سياسة alert-only العامة للمنصة.
   */
  private async classifyWithAi(content: string, senderId: string): Promise<{ isLeakAttempt: boolean } | null> {
    try {
      const role = await this.resolveAiUserRole(senderId);
      const result = await this.aiGateway.call({
        userId: senderId,
        userRole: role,
        featureType: 'contact_leak_detection',
        systemPrompt:
          'أنت مصنِّف أمني بسيط. مهمتك الوحيدة: تحديد هل تحتوي الرسالة التالية محاولة فعلية لمشاركة وسيلة تواصل خارج المنصة (رقم هاتف مموَّه، بريد إلكتروني مموَّه، اسم مستخدم على تطبيق تواصل، أو طلب صريح للتواصل خارجيًا)، أم أنها رسالة بريئة تستخدم كلمات مشابهة في سياق مختلف تمامًا. أجب حصرًا بصيغة JSON: {"isLeakAttempt": true|false}',
        userMessage: content,
        relatedResourceType: 'message_moderation',
      });

      const parsed = JSON.parse(result.text);
      return { isLeakAttempt: Boolean(parsed.isLeakAttempt) };
    } catch (error) {
      this.logger.warn(`فشل تصنيف Layer 2 AI (Fail-Open - لن تُحظر الرسالة): ${(error as Error).message}`);
      return null;
    }
  }

  private async resolveAiUserRole(userId: string): Promise<AiUserRole> {
    const userRole = await this.prisma.userRole.findFirst({
      where: { userId },
      include: { role: true },
    });
    const roleName = userRole?.role.name;
    if (roleName === 'instructor') return 'instructor';
    if (roleName === 'marketing') return 'marketing';
    if (roleName && roleName !== 'student') return 'staff';
    return 'student';
  }

  /** يُسجِّل المخالفة ويفحص التصعيد التراكمي (تحذير عند 3، تصعيد لمراجعة بشرية عند 5) */
  private async recordViolation(
    userId: string,
    violationType: string,
    severity: 'low' | 'medium' | 'high',
    actionTaken: 'content_masked' | 'message_blocked',
  ) {
    const message = await this.prisma.message.findFirst({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });

    await this.prisma.communicationViolation.create({
      data: {
        userId,
        messageId: message?.id ?? '',
        violationType,
        severity,
        actionTaken,
      },
    });

    const recentCount = await this.prisma.communicationViolation.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - VIOLATION_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
      },
    });

    if (recentCount >= ESCALATION_THRESHOLD) {
      await this.securityReview.createCase({
        userId,
        caseType: 'contact_leak_attempt',
        severity: 'high',
        relatedEvents: { violationCount: recentCount },
      });
    } else if (recentCount === WARNING_THRESHOLD) {
      // عند الوصول تحديدًا لعتبة التحذير (وليس كل مرة بعدها) → تحذير تلقائي مرة واحدة.
      // كان TODO(production) صريحًا سابقًا؛ الآن يُنشئ سجل تحذير داخلي فعليًا
      // (عبر Security Review Queue بشدة 'low' بدل قناة منفصلة، حفاظًا على مصدر واحد للحقيقة).
      await this.securityReview.createCase({
        userId,
        caseType: 'contact_leak_attempt',
        severity: 'low',
        relatedEvents: { violationCount: recentCount, note: 'تحذير أول - لم يصل بعد لعتبة التصعيد الكامل' },
      });
    }
  }
}
