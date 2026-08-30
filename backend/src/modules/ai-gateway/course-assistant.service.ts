import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from './ai-gateway.service';
import { RetrievalService } from './rag/retrieval.service';

@Injectable()
export class CourseAssistantService {
  constructor(
    private prisma: PrismaService,
    private aiGateway: AiGatewayService,
    private retrievalService: RetrievalService,
  ) {}

  /**
   * مساعد شرح المحتوى للطالب - محصور صرامةً بمحتوى الدورة المسجَّل بها فقط (RAG).
   * كما اتُّفق عليه: لا يُجيب من معرفته العامة، ويُوضِّح للطالب إن كان السؤال خارج النطاق.
   */
  async askLessonQuestion(studentId: string, courseId: string, question: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (!enrollment) {
      throw new ForbiddenException('يجب أن تكون مسجَّلًا في هذه الدورة لاستخدام المساعد');
    }

    const student = await this.prisma.user.findUniqueOrThrow({ where: { id: studentId } });
    const locale = student.preferredLocale;

    // بحث تشابه فعلي في course_content_embeddings عبر pgvector - محصور بهذه
    // الدورة تحديدًا (JOIN على chapters.course_id) لمنع تسريب محتوى دورات أخرى.
    const retrievedContext = await this.retrievalService.retrieveForCourse(courseId, question, locale);

    const systemPrompt = retrievedContext
      ? `أجب فقط بناءً على المحتوى المرفق أدناه من الدورة. إن لم تجد إجابة كافية في هذا المحتوى، وضّح للطالب أن هذا خارج نطاق الدورة الحالية ولا تُجب من معرفتك العامة.\n\nالمحتوى:\n${retrievedContext}`
      : `لا يوجد محتوى ذو صلة كافية بسؤال الطالب ضمن هذه الدورة. أخبر الطالب بوضوح ولطف أن سؤاله يبدو خارج نطاق محتوى هذه الدورة تحديدًا، واقترح عليه مراجعة المدرب مباشرة أو التأكد من صياغة السؤال بما يخص محتوى الدروس.`;

    const result = await this.aiGateway.call({
      userId: studentId,
      userRole: 'student',
      featureType: 'lesson_qa',
      systemPrompt,
      userMessage: question,
      relatedResourceType: 'course',
      relatedResourceId: courseId,
    });

    return { answer: result.text, hadRelevantContext: Boolean(retrievedContext) };
  }

  /**
   * توليد بنك أسئلة للمدرب - يدخل بحالة draft إلزاميًا، لا يظهر للطلاب
   * حتى مراجعة المدرب وموافقته الصريحة (كما اتُّفق عليه).
   */
  async generateQuestionBank(instructorId: string, lessonId: string, count: number) {
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: { chapter: { include: { course: true } }, translations: true },
    });
    if (lesson.chapter.course.instructorId !== instructorId) {
      throw new ForbiddenException('هذا الدرس ليس ضمن دوراتك');
    }

    const arabicContent = lesson.translations.find((t) => t.locale === 'ar');
    const sourceText = arabicContent
      ? `${arabicContent.title}\n\n${arabicContent.transcript}`
      : lesson.translations[0]
        ? `${lesson.translations[0].title}\n\n${lesson.translations[0].transcript}`
        : '';

    if (!sourceText) {
      throw new ForbiddenException('لا يوجد محتوى نصي (Transcript) لهذا الدرس بعد - أضِفه أولًا قبل توليد الأسئلة');
    }

    const systemPrompt = `ولِّد ${count} سؤال اختيار من متعدد بناءً حصرًا على المحتوى المرفق. أجب فقط بصيغة JSON: [{"question": "...", "options": ["...","...","...","..."], "correctAnswer": "...", "difficulty": "easy|medium|hard"}]\n\nالمحتوى:\n${sourceText}`;

    const result = await this.aiGateway.call({
      userId: instructorId,
      userRole: 'instructor',
      featureType: 'question_bank_gen',
      systemPrompt,
      userMessage: `ولِّد الأسئلة الآن بصيغة JSON فقط`,
      relatedResourceType: 'lesson',
      relatedResourceId: lessonId,
    });

    let parsedQuestions: any[] = [];
    try {
      parsedQuestions = JSON.parse(result.text);
    } catch {
      throw new Error('تعذَّر تحليل استجابة الذكاء الاصطناعي - حاول مجددًا');
    }

    // كل سؤال يدخل كـ draft غير معتمد - لن يظهر للطلاب حتى موافقة المدرب الصريحة
    await this.prisma.questionBankItem.createMany({
      data: parsedQuestions.map((q) => ({
        lessonId,
        questionType: 'mcq' as const,
        questionText: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
        generatedBy: 'ai',
        reviewedByInstructor: false,
        status: 'draft' as const,
        locale: (arabicContent?.locale ?? 'ar') as any,
      })),
    });

    return { generatedCount: parsedQuestions.length, status: 'draft_pending_review' };
  }
}
