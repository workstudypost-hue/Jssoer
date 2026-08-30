import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentPlansService } from './payment-plans.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private paymentPlansService: PaymentPlansService,
  ) {}

  @Post('initiate')
  initiatePayment(@Body() dto: InitiatePaymentDto, @Req() req: any) {
    return this.paymentsService.initiatePayment({ ...dto, studentId: req.user.sub });
  }

  @Post('plans')
  createPaymentPlan(@Body() dto: CreatePaymentPlanDto, @Req() req: any) {
    return this.paymentPlansService.createPlan(dto, req.user.sub);
  }
}
