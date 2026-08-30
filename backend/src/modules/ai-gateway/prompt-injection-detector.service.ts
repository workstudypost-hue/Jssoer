import { Injectable } from '@nestjs/common';

export interface InjectionCheckResult {
  flagged: boolean;
  severity: 'low' | 'medium' | 'high';
  matchedPatterns: string[];
}

/**
 * طبقة كشف أولى (Regex/Heuristic) لمحاولات حقن أوامر داخل رسائل المستخدم -
 * سواء لتجاوز نطاق مساعد الدورة (الخروج عن RAG والإجابة من معرفة عامة/ضارة)،
 * أو لانتحال تعليمات نظام مزيّفة. هذه طبقة أولى رخيصة (بدون استدعاء API) -
 * لا تحل محل مراجعة بشرية للحالات severity='high' (تُعلَّم كذلك في AiModerationFlag
 * وتُحوَّل لطابور المراجعة الأمنية الموحّد - Security Review Queue).
 */
@Injectable()
export class PromptInjectionDetectorService {
  private readonly highSeverityPatterns: { pattern: RegExp; label: string }[] = [
    { pattern: /تجاهل\s+(كل\s+)?(التعليمات|الأوامر|ما\s+سبق)/i, label: 'ignore_instructions_ar' },
    { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i, label: 'ignore_instructions_en' },
    { pattern: /you\s+are\s+now\s+(a|an)\s+\w+/i, label: 'role_override_en' },
    { pattern: /أنت\s+الآن\s+(بمثابة|تمثل|أصبحت)/i, label: 'role_override_ar' },
    { pattern: /system\s*prompt|النظام\s*الأساسي\s*للتعليمات/i, label: 'system_prompt_probe' },
    { pattern: /reveal\s+your\s+(instructions|prompt|system)/i, label: 'prompt_exfiltration_en' },
    { pattern: /اكشف|اظهر\s+.{0,15}(تعليماتك|برومبت|النظام)/i, label: 'prompt_exfiltration_ar' },
    { pattern: /<\s*\/?\s*(system|instructions?)\s*>/i, label: 'fake_xml_tags' },
  ];

  private readonly mediumSeverityPatterns: { pattern: RegExp; label: string }[] = [
    { pattern: /(jailbreak|dan\s+mode|developer\s+mode)/i, label: 'known_jailbreak_terms' },
    { pattern: /من\s+الآن\s+فصاعدًا/i, label: 'behavior_override_ar' },
  ];

  check(userMessage: string): InjectionCheckResult {
    const matched: string[] = [];
    let severity: InjectionCheckResult['severity'] = 'low';

    for (const { pattern, label } of this.highSeverityPatterns) {
      if (pattern.test(userMessage)) {
        matched.push(label);
        severity = 'high';
      }
    }

    if (severity !== 'high') {
      for (const { pattern, label } of this.mediumSeverityPatterns) {
        if (pattern.test(userMessage)) {
          matched.push(label);
          severity = 'medium';
        }
      }
    }

    return { flagged: matched.length > 0, severity, matchedPatterns: matched };
  }
}
