import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CourseAssistantService } from './course-assistant.service';
import { QuestionBankReviewService } from './question-bank-review.service';
import { ContentIngestionService } from './rag/content-ingestion.service';
import { AskLessonQuestionDto } from './dto/ask-lesson-question.dto';
import { GenerateQuestionBankDto } from './dto/generate-question-bank.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiGatewayController {
  constructor(
    private courseAssistant: CourseAssistantService,
    private questionBankReview: QuestionBankReviewService,
    private contentIngestion: ContentIngestionService,
  ) {}

  @Post('lesson-qa')
  askQuestion(@Body() dto: AskLessonQuestionDto, @Req() req: any) {
    return this.courseAssistant.askLessonQuestion(req.user.sub, dto.courseId, dto.question);
  }

  @Post('question-bank/generate')
  generateQuestionBank(@Body() dto: GenerateQuestionBankDto, @Req() req: any) {
    return this.courseAssistant.generateQuestionBank(req.user.sub, dto.lessonId, dto.count);
  }

  @Get('question-bank/:lessonId/drafts')
  listDrafts(@Param('lessonId') lessonId: string, @Req() req: any) {
    return this.questionBankReview.listDraftQuestions(req.user.sub, lessonId);
  }

  @Post('question-bank/:id/approve')
  approveQuestion(@Param('id') id: string, @Req() req: any) {
    return this.questionBankReview.approve(req.user.sub, id);
  }

  @Post('question-bank/:id/reject')
  rejectQuestion(@Param('id') id: string, @Req() req: any) {
    return this.questionBankReview.reject(req.user.sub, id);
  }

  /**
   * إعادة فهرسة محتوى دورة كاملة في pgvector (Embeddings) - يُستدعى يدويًا من
   * لوحة المدرب بعد إضافة/تعديل نصوص الدروس (Transcripts)، وسيُستدعى تلقائيًا
   * لاحقًا من موديول courses عند نشر الدورة (غير موجود بعد في هذا السكافولد).
   */
  @Post('courses/:courseId/reindex')
  reindexCourse(@Param('courseId') courseId: string) {
    return this.contentIngestion.ingestCourseContent(courseId);
  }
}
