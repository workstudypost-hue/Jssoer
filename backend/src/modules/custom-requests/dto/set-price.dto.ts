import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SetPriceDto {
  @IsNumber()
  @Min(1)
  proposedPrice: number;

  @IsInt()
  @Min(1)
  estimatedDeliveryDays: number;

  @IsOptional()
  @IsString()
  priceBreakdownNotes?: string;
}
