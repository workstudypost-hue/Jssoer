import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { GatewayProvider, PaymentPlanRelatedType } from '@prisma/client';

export class InitiatePaymentDto {
  @IsNumber()
  @Min(1)
  amountUsd: number;

  @IsString()
  currency: string;

  @IsEnum(GatewayProvider)
  provider: GatewayProvider;

  @IsEnum(PaymentPlanRelatedType)
  relatedType: PaymentPlanRelatedType;

  @IsUUID()
  relatedId: string;

  @IsOptional()
  @IsUUID()
  installmentId?: string;
}
