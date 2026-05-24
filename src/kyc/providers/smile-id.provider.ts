import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import {
  CreateKycSessionInput,
  KycProvider,
  KycSessionResult,
  KycWebhookEvent,
} from './kyc.provider';

const SMILE_ID_BASE_URL = 'https://api.smileidentity.com';

@Injectable()
export class SmileIdProvider implements KycProvider {
  readonly providerName = 'SMILE_ID';

  private readonly partnerId: string;
  private readonly apiKey: string;
  private readonly callbackUrl: string;

  constructor() {
    const partnerId = process.env.SMILE_ID_PARTNER_ID;
    const apiKey = process.env.SMILE_ID_API_KEY;
    const callbackUrl = process.env.SMILE_ID_CALLBACK_URL;

    if (!partnerId) {
      throw new Error('SmileIdProvider requires SMILE_ID_PARTNER_ID to be set');
    }
    if (!apiKey) {
      throw new Error('SmileIdProvider requires SMILE_ID_API_KEY to be set');
    }
    if (!callbackUrl) {
      throw new Error(
        'SmileIdProvider requires SMILE_ID_CALLBACK_URL to be set',
      );
    }

    this.partnerId = partnerId;
    this.apiKey = apiKey;
    this.callbackUrl = callbackUrl;
  }

  async createVerificationSession(
    input: CreateKycSessionInput,
  ): Promise<KycSessionResult> {
    const credentials = Buffer.from(
      `${this.partnerId}:${this.apiKey}`,
    ).toString('base64');

    const response = await fetch(
      `${SMILE_ID_BASE_URL}/v1/hosted_web/session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          partner_id: this.partnerId,
          callback_url: this.callbackUrl,
          user_id: input.userId,
          id_types: ['ID_CARD', 'PASSPORT'],
          country: 'CM',
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new BadRequestException(
        data?.error ?? data?.message ?? 'Smile ID session creation failed',
      );
    }

    return {
      sessionId: data.session_id,
      status: 'pending',
      sessionUrl: data.url ?? null,
      rawStatus: 'PENDING',
      failureCode: null,
      failureReason: null,
    };
  }

  async retrieveSession(providerSessionId: string): Promise<KycSessionResult> {
    const credentials = Buffer.from(
      `${this.partnerId}:${this.apiKey}`,
    ).toString('base64');

    const response = await fetch(
      `${SMILE_ID_BASE_URL}/v1/hosted_web/session/${providerSessionId}`,
      {
        method: 'GET',
        headers: { Authorization: `Basic ${credentials}` },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new BadRequestException(
        data?.error ?? data?.message ?? 'Smile ID session retrieval failed',
      );
    }

    const rawStatus: string = data.status ?? '';

    return {
      sessionId: providerSessionId,
      status: this.mapSmileStatus(rawStatus),
      sessionUrl: data.url ?? null,
      rawStatus,
      failureCode: data.failure_code ?? null,
      failureReason: data.failure_reason ?? null,
    };
  }

  verifyWebhookSignature(
    payload: string,
    headers: Record<string, string>,
  ): boolean {
    const signature = headers['x-smile-id-signature'];
    if (!signature) return false;

    const expected = createHmac('sha256', this.apiKey)
      .update(payload)
      .digest('hex');

    return signature === expected;
  }

  parseWebhookEvent(payload: string): KycWebhookEvent {
    const body = JSON.parse(payload);
    const rawStatus: string = body.status ?? '';

    return {
      sessionId: body.session_id,
      status: this.mapSmileStatus(rawStatus),
      rawStatus,
      failureCode: body.failure_code ?? null,
      failureReason: body.failure_reason ?? null,
    };
  }

  private mapSmileStatus(
    raw: string,
  ): 'pending' | 'verified' | 'rejected' | 'canceled' {
    switch (raw.toUpperCase()) {
      case 'COMPLETE':
      case 'APPROVED':
        return 'verified';
      case 'REJECTED':
      case 'DECLINED':
        return 'rejected';
      case 'EXPIRED':
      case 'CANCELLED':
        return 'canceled';
      default:
        return 'pending';
    }
  }
}
