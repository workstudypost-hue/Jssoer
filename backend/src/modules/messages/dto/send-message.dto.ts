import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { MessageContextType } from '@prisma/client';

export class SendMessageDto {
  @IsUUID()
  threadId: string;

  @IsEnum(MessageContextType)
  contextType: MessageContextType;

  @IsUUID()
  contextId: string;

  @IsString()
  @MinLength(1)
  content: string;
}
