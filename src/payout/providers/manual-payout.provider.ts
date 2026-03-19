import { Injectable } from '@nestjs/common';
import { PayoutProvider, PayoutStatus } from '@prisma/client';
import {
  PayoutProviderAdapter,
  PayoutProviderResult,
  PayoutRequestContext,
} from '../payout.provider';

@Injectable()
export class ManualPayoutProvider implements PayoutProviderAdapter {
  readonly provider = PayoutProvider.MANUAL;

  async requestPayout(
    input: PayoutRequestContext,
  ): Promise<PayoutProviderResult> {
    return {
      status: PayoutStatus.REQUESTED,
      externalReference: `manual:${input.payoutId}`,
      metadata: {
        mode: 'manual',
        provider: this.provider,
        transactionId: input.transactionId,
        payoutId: input.payoutId,
        amount: input.amount,
        currency: input.currency,
      },
    };
  }
}