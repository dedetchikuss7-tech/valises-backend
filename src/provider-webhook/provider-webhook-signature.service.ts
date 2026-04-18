import { Injectable } from '@nestjs/common';
import {
  createHmac,
  timingSafeEqual,
} from 'crypto';
import { IngestProviderWebhookEventDto } from './dto/ingest-provider-webhook-event.dto';
import {
  ProviderWebhookHeaders,
  ProviderWebhookVerificationResult,
} from './provider-webhook.types';

@Injectable()
export class ProviderWebhookSignatureService {
  verify(
    dto: IngestProviderWebhookEventDto,
    headers: ProviderWebhookHeaders,
  ): ProviderWebhookVerificationResult {
    const provider = this.normalizeProvider(dto.provider);
    const secret = this.resolveSecret(provider);

    if (!this.isSignatureSupported(provider)) {
      return {
        status: 'NOT_SUPPORTED_PROVIDER',
        provider,
        secretConfigured: Boolean(secret),
      };
    }

    if (!secret) {
      return {
        status: 'BYPASSED_NO_SECRET',
        provider,
        secretConfigured: false,
      };
    }

    const signature = String(headers.signature ?? '').trim();
    if (!signature) {
      return {
        status: 'FAILED_MISSING_SIGNATURE',
        provider,
        secretConfigured: true,
      };
    }

    const canonicalPayload = this.buildCanonicalPayload(dto);
    const expected = this.buildSignature(secret, canonicalPayload);
    const received = this.normalizeSignature(signature);

    const isValid = this.safeEqual(expected, received);

    return {
      status: isValid ? 'VERIFIED' : 'FAILED_INVALID_SIGNATURE',
      provider,
      secretConfigured: true,
    };
  }

  buildSignature(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private isSignatureSupported(provider: string): boolean {
    return provider === 'MOCK_STRIPE';
  }

  private resolveSecret(provider: string): string | null {
    if (provider === 'MOCK_STRIPE') {
      return (
        process.env.PROVIDER_WEBHOOK_SECRET_MOCK_STRIPE ??
        process.env.MOCK_STRIPE_WEBHOOK_SECRET ??
        null
      );
    }

    return null;
  }

  private normalizeProvider(value: string): string {
    return String(value ?? '').trim().toUpperCase();
  }

  private normalizeSignature(signature: string): string {
    const trimmed = signature.trim();
    if (trimmed.startsWith('sha256=')) {
      return trimmed.slice('sha256='.length);
    }
    return trimmed;
  }

  private buildCanonicalPayload(dto: IngestProviderWebhookEventDto): string {
    return this.stableStringify({
      provider: this.normalizeProvider(dto.provider),
      objectType: dto.objectType,
      eventType: dto.eventType,
      idempotencyKey: dto.idempotencyKey,
      transactionId: dto.transactionId ?? null,
      payoutId: dto.payoutId ?? null,
      refundId: dto.refundId ?? null,
      externalReference: dto.externalReference ?? null,
      occurredAt: dto.occurredAt ?? null,
      payload: dto.payload ?? {},
    });
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'string') {
      return JSON.stringify(value);
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([key, val]) =>
            `${JSON.stringify(key)}:${this.stableStringify(val)}`,
        );

      return `{${entries.join(',')}}`;
    }

    return JSON.stringify(String(value));
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}