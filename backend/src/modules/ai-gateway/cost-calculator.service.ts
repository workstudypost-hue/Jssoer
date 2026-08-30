import { Injectable } from '@nestjs/common';

/**
 * أسعار Claude API لكل مليون توكن (USD) - قيم Anthropic المُعلنة رسميًا وقت كتابة
 * هذا الكود. يجب تحديث هذا الجدول يدويًا عند تغيّر أسعار Anthropic (لا API عام
 * لجلبها ديناميكيًا)، لذلك يُفضَّل مراجعته دوريًا كجزء من صيانة AI Gateway.
 */
const PRICING_PER_MILLION_TOKENS_USD: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 15, output: 75 },
  // نموذج احتياطي غير معروف - يُستخدم فقط إن لم يُطابَق أي مفتاح أعلاه، حتى لا يُسجَّل costUsd=0 صامتًا
  default: { input: 3, output: 15 },
};

@Injectable()
export class CostCalculatorService {
  calculateCostUsd(modelId: string, promptTokens: number, completionTokens: number): number {
    const pricing = PRICING_PER_MILLION_TOKENS_USD[modelId] ?? PRICING_PER_MILLION_TOKENS_USD.default;
    const inputCost = (promptTokens / 1_000_000) * pricing.input;
    const outputCost = (completionTokens / 1_000_000) * pricing.output;
    return Number((inputCost + outputCost).toFixed(6));
  }
}
