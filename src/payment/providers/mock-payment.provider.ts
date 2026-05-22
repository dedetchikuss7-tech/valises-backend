import { Injectable } from '@nestjs/common';
import {
  PaymentIntentContext,
  PaymentIntentResult,
  PaymentProviderAdapter,
} from '../payment.provider';

@Injectable()
export class MockPaymentProvider implements PaymentProviderAdapter {
  async createPaymentIntent(
    context: PaymentIntentContext,
  ): Promise<PaymentIntentResult> {
    return {
      checkoutUrl: `https://mock-pay.local/checkout/${context.transactionId}`,
      paymentIntentId: `mock_${context.transactionId}_${Date.now()}`,
      provider: 'MOCK',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      metadata: {
        mode: 'mock',
        transactionId: context.transactionId,
        amount: context.amount,
        currency: context.currency,
      },
    };
  }
}
