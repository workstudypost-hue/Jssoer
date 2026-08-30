import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateReportDto {
  @IsString()
  reportKey: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsIn(['json', 'pdf', 'xlsx'])
  exportFormat?: 'json' | 'pdf' | 'xlsx';
}
