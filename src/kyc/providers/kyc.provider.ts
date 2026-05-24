export const KYC_PROVIDER = 'KYC_PROVIDER_TOKEN';

export interface CreateKycSessionInput {
  userId: string;
  email: string;
  returnUrl?: string;
}

export interface KycSessionResult {
  sessionId: string;
  status: 'pending' | 'verified' | 'rejected' | 'canceled';
  sessionUrl: string | null;
  rawStatus: string;
  failureCode: string | null;
  failureReason: string | null;
}

export interface KycWebhookEvent {
  sessionId: string;
  status: 'pending' | 'verified' | 'rejected' | 'canceled';
  rawStatus: string;
  failureCode: string | null;
  failureReason: string | null;
}

export abstract class KycProvider {
  abstract readonly providerName: string;
  abstract createVerificationSession(
    input: CreateKycSessionInput,
  ): Promise<KycSessionResult>;
  abstract retrieveSession(
    providerSessionId: string,
  ): Promise<KycSessionResult>;
  abstract verifyWebhookSignature(
    payload: string,
    headers: Record<string, string>,
  ): boolean;
  abstract parseWebhookEvent(payload: string): KycWebhookEvent;
}
