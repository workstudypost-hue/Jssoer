import { Injectable } from '@nestjs/common';

/**
 * تقطيع بسيط بحد كلمات تقريبي مع تداخل (Overlap) بين القطع - يمنع فقدان السياق
 * عند وقوع فكرة مهمة على حدود قطعتين. مصمَّم للنص العربي (لا يعتمد أي مكتبة
 * Tokenizer إنجليزية الأساس، بل تقسيم على الجمل ثم تجميع حتى الحد الأقصى).
 */
@Injectable()
export class ChunkingService {
  private readonly MAX_WORDS_PER_CHUNK = 220;
  private readonly OVERLAP_WORDS = 40;

  chunkText(text: string): string[] {
    const sentences = text
      .split(/(?<=[.!؟?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let currentWords: string[] = [];

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/);
      if (currentWords.length + sentenceWords.length > this.MAX_WORDS_PER_CHUNK && currentWords.length > 0) {
        chunks.push(currentWords.join(' '));
        // التداخل: نُبقي آخر N كلمة من القطعة الحالية كبداية للقطعة التالية
        currentWords = currentWords.slice(-this.OVERLAP_WORDS);
      }
      currentWords.push(...sentenceWords);
    }
    if (currentWords.length > 0) {
      chunks.push(currentWords.join(' '));
    }

    return chunks;
  }
}
