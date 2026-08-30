import { IsOptional, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  identifier: string; // البريد أو رقم الهاتف

  @IsString()
  @Length(6, 6, { message: 'رمز التحقق يجب أن يتكون من 6 أرقام' })
  code: string;

  @IsOptional()
  @IsString()
  deviceFingerprint?: string;
}
