import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Locale } from '@prisma/client';

export class RegisterDto {
  @IsOptional()
  @IsEmail({}, { message: 'صيغة البريد الإلكتروني غير صحيحة' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب ألا تقل عن 8 أحرف' })
  password: string;

  @IsEnum(Locale)
  preferredLocale: Locale;

  // الدور المطلوب عند التسجيل الذاتي: طالب أو مدرب فقط
  // (لا يوجد مسار تسجيل ذاتي لأي دور آخر - هذا يُفرض في الـ Service وليس فقط هنا)
  @IsString()
  requestedRole: 'student' | 'instructor';
}
