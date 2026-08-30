import { IsInt, IsUUID, Min, Max } from 'class-validator';

export class GenerateQuestionBankDto {
  @IsUUID()
  lessonId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  count: number;
}
