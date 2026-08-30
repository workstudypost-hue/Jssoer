-- تفعيل pgvector لبناء خط أنابيب RAG الفعلي (البحث عن أقرب المحتوى دلاليًا للسؤال).
-- Prisma Schema لا يدعم النوع "vector" أصلًا (raw type)، لذلك عمود embedding
-- والفهرس المرتبط به يُضافان يدويًا هنا بدل تعريفهما في schema.prisma.
--
-- طريقة التشغيل (مرة واحدة لكل بيئة، بعد `prisma migrate deploy` الاعتيادي):
--   psql "$DATABASE_URL" -f prisma/sql/pgvector-setup.sql
-- أو عبر: npx prisma db execute --file prisma/sql/pgvector-setup.sql --schema prisma/schema.prisma

CREATE EXTENSION IF NOT EXISTS vector;

-- Voyage AI "voyage-3" ينتج متجهات بأبعاد 1024 (راجع embedding.service.ts) -
-- إن تغيّر النموذج مستقبلًا، يجب تحديث الرقم هنا وإعادة فهرسة كل الصفوف الحالية.
ALTER TABLE course_content_embeddings
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- HNSW أسرع من IVFFlat للاستعلامات التفاعلية (سؤال الطالب المباشر) وحجم بياناتنا
-- (آلاف الدروس وليس ملايين) - راجع توثيق pgvector لمقارنة الخوارزميتين
CREATE INDEX IF NOT EXISTS course_content_embeddings_embedding_idx
  ON course_content_embeddings
  USING hnsw (embedding vector_cosine_ops);
