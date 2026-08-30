/**
 * Layer 1: كشف Regex فوري - يُمسك أغلب محاولات التسريب المباشرة قبل أي استدعاء AI.
 * كما اتُّفق عليه: لا نستدعي AI إلا للحالات الملتبسة التي يفوتها هذا الفحص.
 */

export interface DetectionResult {
  matched: boolean;
  patterns: string[];
  confidence: 'high' | 'medium' | 'low';
}

const PATTERNS: Record<string, RegExp> = {
  phone_number: /(\+?\d[\d\s\-().]{7,}\d)/g,
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  whatsapp_mention: /(واتساب|whatsapp|واتس|wa\.me)/gi,
  telegram_mention: /(تيليجرام|telegram|@[\w]{5,})/gi,
  social_handle: /(instagram\.com|snap(chat)?|tiktok)\/?[\w.]*/gi,
  spaced_digits: /\d\s+\d\s+\d\s+\d/g,
  disguised_at: /\[at\]|\(at\)/gi,
};

// كلمات "بوابة" تُستخدم لرفع حساسية الفحص في Layer 2 دون حظر مباشر (ثقة منخفضة/متوسطة فقط)
const CONTEXT_TRIGGER_WORDS = /تواصل خارج|بشكل مباشر|أرخص لو|رقمي هو|contact me directly/gi;

export function runRegexDetection(text: string): DetectionResult {
  const matchedPatterns: string[] = [];

  for (const [name, regex] of Object.entries(PATTERNS)) {
    if (regex.test(text)) matchedPatterns.push(name);
    regex.lastIndex = 0; // إعادة تعيين lastIndex لأن الأنماط تحمل /g
  }

  if (matchedPatterns.length > 0) {
    // أرقام هاتف أو بريد صريح = ثقة عالية، تُحظر فورًا
    const highConfidencePatterns = ['phone_number', 'email'];
    const hasHighConfidence = matchedPatterns.some((p) => highConfidencePatterns.includes(p));
    return {
      matched: true,
      patterns: matchedPatterns,
      confidence: hasHighConfidence ? 'high' : 'medium',
    };
  }

  if (CONTEXT_TRIGGER_WORDS.test(text)) {
    CONTEXT_TRIGGER_WORDS.lastIndex = 0;
    return { matched: true, patterns: ['context_trigger_words'], confidence: 'low' };
  }

  return { matched: false, patterns: [], confidence: 'low' };
}

/** يُخفي الجزء المطابق فقط (للحالات متوسطة الثقة) بدل حظر الرسالة كاملة */
export function maskDetectedContent(text: string): string {
  let masked = text;
  for (const regex of Object.values(PATTERNS)) {
    masked = masked.replace(regex, '[محتوى مخفي لمخالفة سياسة التواصل]');
    regex.lastIndex = 0;
  }
  return masked;
}
