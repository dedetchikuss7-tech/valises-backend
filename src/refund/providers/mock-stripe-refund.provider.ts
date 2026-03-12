import { Injectable } from '@nestjs/common';
import { RefundProvider, RefundStatus } from '@prisma/client';
import {
  RefundProviderAdapter,
  RefundProviderResult,
  RefundRequestContext,
} from '../refund.provider';

@Injectable()
export class MockStripeRefundProvider implements RefundProviderAdapter {
  readonly provider = RefundProvider.MOCK_STRIPE;

  async requestRefund(input: RefundRequestContext): Promise<RefundProviderResult> {
    return {
      status: RefundStatus.PROCESSING,
      externalReference: `mock_stripe_refund:${input.refundId}`,
      metadata: {
        mode: 'mock_stripe',
        transactionId: input.transactionId,
      },
    };
  }
}