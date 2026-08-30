import { IsString, MinLength } from 'class-validator';

export class RejectPayoutDto {
  @IsString()
  @MinLength(5, { message: 'سبب الرفض مطلوب وبتفصيل كافٍ' })
  reason: string;
}
