import { IsOptional, IsString, MinLength } from 'class-validator';

export class ReasonNoteDto {
  @IsString()
  @MinLength(3)
  message: string;
}

export class QualityReviewDto {
  @IsString()
  decision: 'approve' | 'request_revision';

  @IsOptional()
  @IsString()
  feedback?: string;
}
