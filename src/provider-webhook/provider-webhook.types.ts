import { ProviderEventObjectType } from '@prisma/client';

export type ProviderWebhookHeaders = {
  signature?: string;
  deliveryId?: string;
  providerTimestamp?: string;
};

export type ProviderWebhookVerificationStatus =
  | 'VERIFIED'
  | 'BYPASSED_NO_SECRET'
  | 'NOT_SUPPORTED_PROVIDER'
  | 'FAILED_MISSING_SIGNATURE'
  | 'FAILED_INVALID_SIGNATURE';

export type ProviderWebhookVerificationResult = {
  status: ProviderWebhookVerificationStatus;
  provider: string;
  secretConfigured: boolean;
};

export type NormalizedProviderWebhookEvent = {
  provider: string;
  objectType: ProviderEventObjectType;
  eventType: string;
  idempotencyKey: string;
  transactionId?: string | null;
  payoutId?: string | null;
  refundId?: string | null;
  externalReference?: string | null;
  occurredAt?: string | null;
  payload: Record<string, unknown>;
  webhook: {
    receivedAt: string;
    signature: string | null;
    deliveryId: string | null;
    providerTimestamp: string | null;
    signatureVerificationStatus: ProviderWebhookVerificationStatus;
    signatureSecretConfigured: boolean;
  };
};