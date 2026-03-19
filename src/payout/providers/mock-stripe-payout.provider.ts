import { Injectable } from '@nestjs/common';
import { PayoutProvider, PayoutStatus } from '@prisma/client';
import {
  PayoutProviderAdapter,
  PayoutProviderResult,
  PayoutRequestContext,
} from '../payout.provider';

@Injectable()
export class MockStripePayoutProvider implements PayoutProviderAdapter {
  readonly provider = PayoutProvider.MOCK_STRIPE;

  async requestPayout(
    input: PayoutRequestContext,
  ): Promise<PayoutProviderResult> {
    return {
      status: PayoutStatus.PROCESSING,
      externalReference: `mock_stripe:${input.payoutId}`,
      metadata: {
        mode: 'mock_stripe',
        provider: this.provider,
        transactionId: input.transactionId,
        payoutId: input.payoutId,
        amount: input.amount,
        currency: input.currency,
      },
    };
  }
}