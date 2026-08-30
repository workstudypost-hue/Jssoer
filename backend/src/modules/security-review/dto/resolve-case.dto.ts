import { IsEnum, IsString } from 'class-validator';
import { SecurityCaseResolution } from '@prisma/client';

export class ResolveSecurityCaseDto {
  @IsEnum(SecurityCaseResolution)
  resolution: SecurityCaseResolution;

  @IsString()
  notes: string;
}
