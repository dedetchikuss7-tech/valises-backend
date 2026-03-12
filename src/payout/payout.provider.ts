import { PayoutProvider } from '@prisma/client';

export type PayoutRequestContext = {
  payoutId: string;
  transactionId: string;
  amount: number;
  currency: string;
  provider: PayoutProvider;
};

export type PayoutProviderResult = {
  status: 'REQUESTED' | 'PROCESSING';
  externalReference?: string | null;
  metadata?: Record<string, unknown>;
};

export interface PayoutProviderAdapter {
  readonly provider: PayoutProvider;
  requestPayout(input: PayoutRequestContext): Promise<PayoutProviderResult>;
}