import { IsOptional, IsString } from 'class-validator';

export class RejectInstructorDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
