import { Injectable } from '@nestjs/common';
import { RefundProvider, RefundStatus } from '@prisma/client';
import {
  RefundProviderAdapter,
  RefundProviderResult,
  RefundRequestContext,
} from '../refund.provider';

@Injectable()
export class ManualRefundProvider implements RefundProviderAdapter {
  readonly provider = RefundProvider.MANUAL;

  async requestRefund(input: RefundRequestContext): Promise<RefundProviderResult> {
    return {
      status: RefundStatus.REQUESTED,
      externalReference: `manual_refund:${input.refundId}`,
      metadata: {
        mode: 'manual',
        transactionId: input.transactionId,
      },
    };
  }
}