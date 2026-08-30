import { IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  identifier: string; // بريد أو هاتف (للطلاب/المدربين) أو بريد فقط (للموظفين)

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  deviceFingerprint?: string;
}
