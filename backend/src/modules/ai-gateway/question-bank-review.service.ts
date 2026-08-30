import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuestionBankReviewService {
  constructor(private prisma: PrismaService) {}

  async listDraftQuestions(instructorId: string, lessonId: string) {
    await this.assertInstructorOwnsLesson(instructorId, lessonId);
    return this.prisma.questionBankItem.findMany({ where: { lessonId, status: 'draft' } });
  }

  async approve(instructorId: string, questionId: string) {
    const question = await this.prisma.questionBankItem.findUniqueOrThrow({ where: { id: questionId } });
    await this.assertInstructorOwnsLesson(instructorId, question.lessonId);
    return this.prisma.questionBankItem.update({
      where: { id: questionId },
      data: { status: 'approved', reviewedByInstructor: true },
    });
  }

  async reject(instructorId: string, questionId: string) {
    const question = await this.prisma.questionBankItem.findUniqueOrThrow({ where: { id: questionId } });
    await this.assertInstructorOwnsLesson(instructorId, question.lessonId);
    return this.prisma.questionBankItem.update({
      where: { id: questionId },
      data: { status: 'rejected', reviewedByInstructor: true },
    });
  }

  private async assertInstructorOwnsLesson(instructorId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: { chapter: { include: { course: true } } },
    });
    if (lesson.chapter.course.instructorId !== instructorId) {
      throw new ForbiddenException('هذا الدرس ليس ضمن دوراتك');
    }
  }
}
