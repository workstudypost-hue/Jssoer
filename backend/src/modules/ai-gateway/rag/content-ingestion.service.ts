import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { ChunkingService } from './chunking.service';
import { Locale } from '@prisma/client';

/**
 * فهرسة محتوى درس واحد: يحذف الفهرسة القديمة لهذا الدرس (إن وُجدت) ثم يُعيد
 * التقطيع والتضمين من الصفر. يُستدعى عند: نشر درس جديد، أو تعديل transcript
 * موجود (من LessonsService - راجع hook في courses module).
 */
@Injectable()
export class ContentIngestionService {
  private readonly logger = new Logger(ContentIngestionService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    private chunkingService: ChunkingService,
  ) {}

  async ingestLessonContent(lessonId: string, locale: Locale, title: string, transcript: string) {
    // حذف الفهرسة القديمة لهذا الدرس/اللغة قبل إعادة الإنشاء (تفادي تكرار قطع قديمة)
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM course_content_embeddings WHERE lesson_id = $1 AND locale = $2::"Locale"`,
      lessonId,
      locale,
    );

    const fullText = `${title}\n\n${transcript}`;
    const chunks = this.chunkingService.chunkText(fullText);
    if (chunks.length === 0) return { chunksIndexed: 0 };

    const embeddings = await this.embeddingService.embedTexts(chunks, 'document');

    for (let i = 0; i < chunks.length; i++) {
      const rowId = crypto.randomUUID();
      const vectorLiteral = `[${embeddings[i].join(',')}]`;
      // إدراج خام لأن Prisma Client لا يدعم كتابة النوع vector عبر create() القياسي
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO course_content_embeddings (id, lesson_id, chunk_text, locale, chunk_order, created_at, embedding)
         VALUES ($1, $2, $3, $4::"Locale", $5, now(), $6::vector)`,
        rowId,
        lessonId,
        chunks[i],
        locale,
        i,
        vectorLiteral,
      );
    }

    this.logger.log(`تمت فهرسة ${chunks.length} قطعة للدرس ${lessonId} (${locale})`);
    return { chunksIndexed: chunks.length };
  }

  /** يُعيد فهرسة كل دروس دورة معيّنة (يُستخدم عند نشر الدورة أو بعد تحديث جماعي) */
  async ingestCourseContent(courseId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { chapter: { courseId } },
      include: { translations: true },
    });

    let total = 0;
    for (const lesson of lessons) {
      for (const translation of lesson.translations) {
        const result = await this.ingestLessonContent(
          lesson.id,
          translation.locale,
          translation.title,
          translation.transcript,
        );
        total += result.chunksIndexed;
      }
    }
    return { lessonsProcessed: lessons.length, chunksIndexed: total };
  }
}
