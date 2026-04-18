import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PayoutProvider,
  ProviderEventObjectType,
  RefundProvider,
} from '@prisma/client';
import { PayoutService } from '../payout/payout.service';
import { RefundService } from '../refund/refund.service';
import { IngestProviderWebhookEventDto } from './dto/ingest-provider-webhook-event.dto';
import { ProviderWebhookSignatureService } from './provider-webhook-signature.service';
import {
  NormalizedProviderWebhookEvent,
  ProviderWebhookHeaders,
} from './provider-webhook.types';

@Injectable()
export class ProviderWebhookService {
  constructor(
    private readonly payoutService: PayoutService,
    private readonly refundService: RefundService,
    private readonly signatureService: ProviderWebhookSignatureService,
  ) {}

  async handleIncomingEvent(
    dto: IngestProviderWebhookEventDto,
    headers: ProviderWebhookHeaders,
  ) {
    const normalized = this.normalizeEvent(dto, headers);

    if (
      normalized.webhook.signatureVerificationStatus ===
        'FAILED_MISSING_SIGNATURE' ||
      normalized.webhook.signatureVerificationStatus ===
        'FAILED_INVALID_SIGNATURE'
    ) {
      throw new UnauthorizedException({
        code: 'PROVIDER_WEBHOOK_SIGNATURE_INVALID',
        message: 'Provider webhook signature verification failed.',
        provider: normalized.provider,
        signatureVerificationStatus:
          normalized.webhook.signatureVerificationStatus,
      });
    }

    if (normalized.objectType === ProviderEventObjectType.PAYOUT) {
      return this.payoutService.ingestProviderEvent({
        provider: normalized.provider as PayoutProvider,
        eventType: normalized.eventType,
        idempotencyKey: normalized.idempotencyKey,
        payoutId: normalized.payoutId ?? null,
        transactionId: normalized.transactionId ?? null,
        externalReference: normalized.externalReference ?? null,
        occurredAt: normalized.occurredAt ?? null,
        payload: normalized.payload,
        actorUserId: null,
      });
    }

    if (normalized.objectType === ProviderEventObjectType.REFUND) {
      return this.refundService.ingestProviderEvent({
        provider: normalized.provider as RefundProvider,
        eventType: normalized.eventType,
        idempotencyKey: normalized.idempotencyKey,
        refundId: normalized.refundId ?? null,
        transactionId: normalized.transactionId ?? null,
        externalReference: normalized.externalReference ?? null,
        occurredAt: normalized.occurredAt ?? null,
        payload: normalized.payload,
        actorUserId: null,
      });
    }

    throw new BadRequestException(
      `Unsupported provider webhook objectType: ${normalized.objectType}`,
    );
  }

  private normalizeEvent(
    dto: IngestProviderWebhookEventDto,
    headers: ProviderWebhookHeaders,
  ): NormalizedProviderWebhookEvent {
    const provider = this.normalizeProvider(dto.provider);
    const verification = this.signatureService.verify(dto, headers);
    const eventType = this.normalizeEventType(
      provider,
      dto.objectType,
      dto.eventType,
    );

    return {
      provider,
      objectType: dto.objectType,
      eventType,
      idempotencyKey: String(dto.idempotencyKey).trim(),
      transactionId: dto.transactionId ?? null,
      payoutId: dto.payoutId ?? null,
      refundId: dto.refundId ?? null,
      externalReference: dto.externalReference ?? null,
      occurredAt: dto.occurredAt ?? null,
      payload: {
        ...(dto.payload ?? {}),
        _webhook: {
          receivedAt: new Date().toISOString(),
          signature: headers.signature ?? null,
          deliveryId: headers.deliveryId ?? null,
          providerTimestamp: headers.providerTimestamp ?? null,
          signatureVerificationStatus: verification.status,
          signatureSecretConfigured: verification.secretConfigured,
        },
      },
      webhook: {
        receivedAt: new Date().toISOString(),
        signature: headers.signature ?? null,
        deliveryId: headers.deliveryId ?? null,
        providerTimestamp: headers.providerTimestamp ?? null,
        signatureVerificationStatus: verification.status,
        signatureSecretConfigured: verification.secretConfigured,
      },
    };
  }

  private normalizeProvider(value: string): string {
    const normalized = String(value ?? '').trim().toUpperCase();

    if (!normalized) {
      throw new BadRequestException('provider is required');
    }

    return normalized;
  }

  private normalizeEventType(
    provider: string,
    objectType: ProviderEventObjectType,
    eventType: string,
  ): string {
    const raw = String(eventType ?? '').trim().toLowerCase();

    if (!raw) {
      throw new BadRequestException('eventType is required');
    }

    if (provider === 'MOCK_STRIPE' && objectType === ProviderEventObjectType.PAYOUT) {
      if (
        raw === 'payout.requested' ||
        raw === 'requested' ||
        raw === 'payout.created'
      ) {
        return 'payout.requested';
      }

      if (
        raw === 'payout.processing' ||
        raw === 'processing' ||
        raw === 'payout.updated.processing'
      ) {
        return 'payout.processing';
      }

      if (
        raw === 'payout.paid' ||
        raw === 'paid' ||
        raw === 'payout.succeeded'
      ) {
        return 'payout.paid';
      }

      if (
        raw === 'payout.failed' ||
        raw === 'failed'
      ) {
        return 'payout.failed';
      }
    }

    if (provider === 'MOCK_STRIPE' && objectType === ProviderEventObjectType.REFUND) {
      if (
        raw === 'refund.requested' ||
        raw === 'requested' ||
        raw === 'refund.created'
      ) {
        return 'refund.requested';
      }

      if (
        raw === 'refund.processing' ||
        raw === 'processing' ||
        raw === 'refund.updated.processing'
      ) {
        return 'refund.processing';
      }

      if (
        raw === 'refund.refunded' ||
        raw === 'refunded' ||
        raw === 'refund.succeeded' ||
        raw === 'charge.refunded'
      ) {
        return 'refund.refunded';
      }

      if (
        raw === 'refund.failed' ||
        raw === 'failed'
      ) {
        return 'refund.failed';
      }
    }

    return raw;
  }
}