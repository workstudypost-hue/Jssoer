import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { Locale } from '@prisma/client';

interface RetrievedChunk {
  chunk_text: string;
  lesson_id: string;
  distance: number;
}

/**
 * الاسترجاع الفعلي: يُضمِّن سؤال الطالب، ثم يبحث عن أقرب K قطعة نصية دلاليًا
 * ضمن دورة واحدة فقط (WHERE lesson_id IN course lessons) - هذا هو القيد الأمني
 * الجوهري: لا يجوز إطلاقًا اختلاط محتوى دورة بأخرى في نفس نتيجة البحث،
 * وإلا صار المساعد يُسرِّب محتوى دورات لم يشترِ بها الطالب.
 */
@Injectable()
export class RetrievalService {
  private readonly TOP_K = 5;
  // عتبة تشابه: مسافة تجاوزية (Cosine Distance) أكبر منها تعني "غير ذي صلة فعليًا" -
  // نُفضِّل عدم إرجاع سياق ضعيف الصلة بدل حشو الـ Prompt بمحتوى مضلِّل
  private readonly MAX_DISTANCE = 0.55;

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
  ) {}

  async retrieveForCourse(courseId: string, question: string, locale: Locale): Promise<string> {
    const questionEmbedding = await this.embeddingService.embedOne(question, 'query');
    const vectorLiteral = `[${questionEmbedding.join(',')}]`;

    const rows = await this.prisma.$queryRawUnsafe<RetrievedChunk[]>(
      `SELECT cce.chunk_text, cce.lesson_id, (cce.embedding <=> $1::vector) AS distance
       FROM course_content_embeddings cce
       INNER JOIN lessons l ON l.id = cce.lesson_id
       INNER JOIN chapters c ON c.id = l.chapter_id
       WHERE c.course_id = $2 AND cce.locale = $3::"Locale"
       ORDER BY cce.embedding <=> $1::vector
       LIMIT $4`,
      vectorLiteral,
      courseId,
      locale,
      this.TOP_K,
    );

    const relevant = rows.filter((r) => r.distance <= this.MAX_DISTANCE);
    if (relevant.length === 0) {
      return ''; // لا سياق ذي صلة كافية - يُترجَم لاحقًا في CourseAssistantService إلى "خارج نطاق الدورة"
    }

    return relevant.map((r, i) => `[مقطع ${i + 1}]\n${r.chunk_text}`).join('\n\n');
  }
}
