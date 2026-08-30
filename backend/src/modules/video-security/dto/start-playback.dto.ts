import { IsString, IsUUID } from 'class-validator';

export class StartPlaybackDto {
  @IsUUID()
  lessonId: string;

  @IsString()
  deviceFingerprint: string;
}
