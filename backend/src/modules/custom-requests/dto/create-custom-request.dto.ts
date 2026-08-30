import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCustomRequestDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
