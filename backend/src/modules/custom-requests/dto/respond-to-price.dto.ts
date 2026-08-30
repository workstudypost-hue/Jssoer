import { IsEnum, IsIn } from 'class-validator';

export class RespondToPriceDto {
  @IsIn(['accept', 'reject'])
  decision: 'accept' | 'reject';

  @IsIn(['full', 'installments'])
  paymentOption: 'full' | 'installments';
}
