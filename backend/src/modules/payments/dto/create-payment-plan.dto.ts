import { IsEnum, IsInt, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { PaymentPlanRelatedType } from '@prisma/client';

export class CreatePaymentPlanDto {
  @IsEnum(PaymentPlanRelatedType)
  relatedType: PaymentPlanRelatedType;

  @IsUUID()
  relatedId: string;

  @IsNumber()
  @Min(1)
  totalAmountUsd: number;

  @IsString()
  billingCurrency: string; // العملة التي سيُحصَّل بها الطالب فعليًا

  @IsInt()
  @Min(1)
  installmentsCount: number;
}
