import { IsString, IsUUID, MinLength } from 'class-validator';

export class AskLessonQuestionDto {
  @IsUUID()
  courseId: string;

  @IsString()
  @MinLength(3)
  question: string;
}
