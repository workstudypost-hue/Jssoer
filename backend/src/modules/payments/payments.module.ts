import { forwardRef, Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentPlansService } from './payment-plans.service';
import { ExchangeRateService } from './exchange-rate.service';
import { WebhooksController } from './webhooks.controller';
import { PaymentGatewayFactory } from './adapters/payment-gateway.factory';
import { StripeAdapter } from './adapters/stripe.adapter';
import { TabbyAdapter } from './adapters/tabby.adapter';
import { PayPalAdapter } from './adapters/paypal.adapter';
import { TamaraAdapter } from './adapters/tamara.adapter';
import { CustomRequestsModule } from '../custom-requests/custom-requests.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => CustomRequestsModule), NotificationsModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [
    PaymentsService,
    PaymentPlansService,
    ExchangeRateService,
    PaymentGatewayFactory,
    StripeAdapter,
    TabbyAdapter,
    PayPalAdapter,
    TamaraAdapter,
  ],
  exports: [PaymentsService, PaymentPlansService, ExchangeRateService],
})
export class PaymentsModule {}
