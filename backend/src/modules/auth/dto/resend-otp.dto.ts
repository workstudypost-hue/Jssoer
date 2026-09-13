import { IsString } from 'class-validator';

export class ResendOtpDto {
  @IsString()
  identifier: string; // البريد أو رقم الهاتف الذي سُجِّل به الحساب
}
