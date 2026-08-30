import { IsEnum, IsOptional, IsUUID, IsObject } from 'class-validator';
import { VideoSecurityEventType } from '@prisma/client';

export class ReportSecurityEventDto {
  @IsUUID()
  lessonId: string;

  @IsEnum(VideoSecurityEventType)
  eventType: VideoSecurityEventType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
