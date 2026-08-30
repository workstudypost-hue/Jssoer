import { IsString, MinLength } from 'class-validator';

export class AcceptStaffInvitationDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب ألا تقل عن 8 أحرف' })
  password: string;
}
