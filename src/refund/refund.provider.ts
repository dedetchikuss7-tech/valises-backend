import { RefundProvider } from '@prisma/client';

export type RefundRequestContext = {
  refundId: string;
  transactionId: string;
  amount: number;
  currency: string;
  provider: RefundProvider;
};

export type RefundProviderResult = {
  status: 'REQUESTED' | 'PROCESSING';
  externalReference?: string | null;
  metadata?: Record<string, unknown>;
};

export interface RefundProviderAdapter {
  readonly provider: RefundProvider;
  requestRefund(input: RefundRequestContext): Promise<RefundProviderResult>;
}