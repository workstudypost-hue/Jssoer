import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { AiUsageGuardService } from './ai-usage-guard.service';
import { AiModelRouterService } from './ai-model-router.service';
import { PromptInjectionDetectorService } from './prompt-injection-detector.service';
import { CostCalculatorService } from './cost-calculator.service';
import { AiUserRole } from '@prisma/client';

export interface AiCallParams {
  userId: string;
  userRole: AiUserRole;
  featureType: string;
  systemPrompt: string;
  userMessage: string;
  relatedResourceType?: string;
  relatedResourceId?: string;
}

/**
 * نقطة الدخول المركزية الوحيدة لأي استدعاء Claude API عبر المنصة.
 * كل ميزة (Q&A الطالب، توليد بنك الأسئلة، صياغة حملات...) تمر من هنا -
 * لا يوجد أي موديول آخر يستدعي Anthropic API مباشرة.
 * يفرض: حدود الاستخدام المرنة + التوجيه متعدد النماذج + كشف Prompt Injection +
 * حساب التكلفة الفعلي + تسجيل شامل لكل تفاعل.
 */
@Injectable()
export class AiGatewayService {
  private anthropic: Anthropic;
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private prisma: PrismaService,
    private usageGuard: AiUsageGuardService,
    private modelRouter: AiModelRouterService,
    private injectionDetector: PromptInjectionDetectorService,
    private costCalculator: CostCalculatorService,
  ) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async call(params: AiCallParams): Promise<{ text: string; interactionId: string }> {
    await this.usageGuard.checkAndIncrement(params.userId, params.userRole, params.featureType);

    // كشف Prompt Injection على رسالة المستخدم قبل استدعاء النموذج إطلاقًا -
    // severity='high' تمنع الاستدعاء بالكامل (سياسة alert-only للأمن العام، لكن
    // هنا الحماية استباقية لأن الهدف حماية سلامة الـ RAG نفسه وليس فقط رصد سلوك مستخدم)
    const injectionCheck = this.injectionDetector.check(params.userMessage);
    if (injectionCheck.flagged) {
      const interaction = await this.prisma.aiInteraction.create({
        data: {
          userId: params.userId,
          userRole: params.userRole,
          featureType: params.featureType,
          modelUsed: 'blocked_pre_call',
          status: injectionCheck.severity === 'high' ? 'moderated_blocked' : 'success',
          relatedResourceType: params.relatedResourceType,
          relatedResourceId: params.relatedResourceId,
        },
      });

      await this.prisma.aiModerationFlag.create({
        data: {
          interactionId: interaction.id,
          flagType: 'prompt_injection',
          severity: injectionCheck.severity,
          actionTaken: injectionCheck.severity === 'high' ? 'blocked' : 'logged_only',
        },
      });

      if (injectionCheck.severity === 'high') {
        this.logger.warn(
          `حُظر استدعاء AI للمستخدم ${params.userId} - أنماط حقن مكتشفة: ${injectionCheck.matchedPatterns.join(', ')}`,
        );
        throw new ForbiddenException(
          'تعذَّر معالجة رسالتك - يبدو أنها تحتوي محتوى غير مسموح به. أعد صياغة سؤالك.',
        );
      }
      // severity='medium': لا نحظر، لكن نُسجِّل ونُكمل الاستدعاء بحذر (Alert-only)
    }

    const routing = await this.modelRouter.getRoutingConfig(params.featureType);

    let response: Anthropic.Message;
    let modelUsed = routing.modelId;
    try {
      response = await this.anthropic.messages.create({
        model: routing.modelId,
        max_tokens: routing.maxTokens,
        temperature: Number(routing.temperature),
        system: params.systemPrompt,
        messages: [{ role: 'user', content: params.userMessage }],
      });
    } catch (error) {
      if (routing.fallbackModelId) {
        modelUsed = routing.fallbackModelId;
        response = await this.anthropic.messages.create({
          model: routing.fallbackModelId,
          max_tokens: routing.maxTokens,
          temperature: Number(routing.temperature),
          system: params.systemPrompt,
          messages: [{ role: 'user', content: params.userMessage }],
        });
      } else {
        throw new BadRequestException('تعذَّر معالجة طلب الذكاء الاصطناعي حاليًا، حاول لاحقًا');
      }
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';

    await this.usageGuard.recordTokenUsage(
      params.userId,
      response.usage.input_tokens + response.usage.output_tokens,
    );

    const costUsd = this.costCalculator.calculateCostUsd(
      modelUsed,
      response.usage.input_tokens,
      response.usage.output_tokens,
    );

    const interaction = await this.prisma.aiInteraction.create({
      data: {
        userId: params.userId,
        userRole: params.userRole,
        featureType: params.featureType,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        costUsd,
        modelUsed,
        status: 'success',
        relatedResourceType: params.relatedResourceType,
        relatedResourceId: params.relatedResourceId,
      },
    });

    return { text, interactionId: interaction.id };
  }
}
