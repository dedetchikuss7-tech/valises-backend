export type PaymentIntentContext = {
  transactionId: string;
  amount: number;
  currency: string;
  description?: string;
  returnUrl?: string;
};

export type PaymentIntentResult = {
  checkoutUrl: string;
  paymentIntentId: string;
  provider: string;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
};

export interface PaymentProviderAdapter {
  createPaymentIntent(context: PaymentIntentContext): Promise<PaymentIntentResult>;
}
