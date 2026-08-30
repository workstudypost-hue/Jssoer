import { IsOptional, IsString } from 'class-validator';

/** حقل بصمة الجهاز الاختياري - يُرسَل من الـ Frontend (مثلًا عبر FingerprintJS) */
export class DeviceFingerprintFields {
  @IsOptional()
  @IsString()
  deviceFingerprint?: string;
}
