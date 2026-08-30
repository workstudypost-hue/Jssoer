import { Injectable } from '@nestjs/common';
import { GatewayProvider } from '@prisma/client';
import { PaymentGatewayAdapter } from './payment-gateway.adapter';
import { StripeAdapter } from './stripe.adapter';
import { TabbyAdapter } from './tabby.adapter';
import { PayPalAdapter } from './paypal.adapter';
import { TamaraAdapter } from './tamara.adapter';

@Injectable()
export class PaymentGatewayFactory {
  constructor(
    private stripeAdapter: StripeAdapter,
    private tabbyAdapter: TabbyAdapter,
    private paypalAdapter: PayPalAdapter,
    private tamaraAdapter: TamaraAdapter,
  ) {}

  getAdapter(provider: GatewayProvider): PaymentGatewayAdapter {
    switch (provider) {
      case 'stripe':
        return this.stripeAdapter;
      case 'tabby':
        return this.tabbyAdapter;
      case 'paypal':
        return this.paypalAdapter;
      case 'tamara':
        return this.tamaraAdapter;
      default:
        throw new Error(`بوابة دفع غير معروفة: ${provider}`);
    }
  }
}
