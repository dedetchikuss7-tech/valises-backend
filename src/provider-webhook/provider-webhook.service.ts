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
    const objectType = dto.objectType;
    const eventType = this.normalizeEventType(provider, objectType, dto.eventType);
    const idempotencyKey = this.normalizeRequiredString(
      dto.idempotencyKey,
      'idempotencyKey',
    );

    this.assertProviderIsSupportedForObjectType(provider, objectType);
    this.assertIdentifierConsistency(dto);

    const verification = this.signatureService.verify(dto, headers);
    const receivedAt = new Date().toISOString();

    return {
      provider,
      objectType,
      eventType,
      idempotencyKey,
      transactionId: this.normalizeOptionalString(dto.transactionId),
      payoutId: this.normalizeOptionalString(dto.payoutId),
      refundId: this.normalizeOptionalString(dto.refundId),
      externalReference: this.normalizeOptionalString(dto.externalReference),
      occurredAt: this.normalizeOptionalString(dto.occurredAt),
      payload: {
        ...(dto.payload ?? {}),
        _webhook: {
          receivedAt,
          signature: headers.signature ?? null,
          deliveryId: headers.deliveryId ?? null,
          providerTimestamp: headers.providerTimestamp ?? null,
          signatureVerificationStatus: verification.status,
          signatureSecretConfigured: verification.secretConfigured,
        },
      },
      webhook: {
        receivedAt,
        signature: headers.signature ?? null,
        deliveryId: headers.deliveryId ?? null,
        providerTimestamp: headers.providerTimestamp ?? null,
        signatureVerificationStatus: verification.status,
        signatureSecretConfigured: verification.secretConfigured,
      },
    };
  }

  private normalizeProvider(value: string): string {
    return this.normalizeRequiredString(value, 'provider').toUpperCase();
  }

  private normalizeRequiredString(value: unknown, fieldName: string): string {
    const normalized = String(value ?? '').trim();

    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }

  private assertProviderIsSupportedForObjectType(
    provider: string,
    objectType: ProviderEventObjectType,
  ) {
    if (
      objectType === ProviderEventObjectType.PAYOUT &&
      !Object.values(PayoutProvider).includes(provider as PayoutProvider)
    ) {
      throw new BadRequestException(
        `Unsupported payout webhook provider: ${provider}`,
      );
    }

    if (
      objectType === ProviderEventObjectType.REFUND &&
      !Object.values(RefundProvider).includes(provider as RefundProvider)
    ) {
      throw new BadRequestException(
        `Unsupported refund webhook provider: ${provider}`,
      );
    }
  }

  private assertIdentifierConsistency(dto: IngestProviderWebhookEventDto) {
    const transactionId = this.normalizeOptionalString(dto.transactionId);
    const payoutId = this.normalizeOptionalString(dto.payoutId);
    const refundId = this.normalizeOptionalString(dto.refundId);
    const externalReference = this.normalizeOptionalString(dto.externalReference);

    if (dto.objectType === ProviderEventObjectType.PAYOUT && refundId) {
      throw new BadRequestException(
        'PAYOUT webhook events must not include refundId',
      );
    }

    if (dto.objectType === ProviderEventObjectType.REFUND && payoutId) {
      throw new BadRequestException(
        'REFUND webhook events must not include payoutId',
      );
    }

    if (
      dto.objectType === ProviderEventObjectType.PAYOUT &&
      !payoutId &&
      !transactionId &&
      !externalReference
    ) {
      throw new BadRequestException(
        'PAYOUT webhook events require payoutId, transactionId, or externalReference',
      );
    }

    if (
      dto.objectType === ProviderEventObjectType.REFUND &&
      !refundId &&
      !transactionId &&
      !externalReference
    ) {
      throw new BadRequestException(
        'REFUND webhook events require refundId, transactionId, or externalReference',
      );
    }
  }

  private normalizeEventType(
    provider: string,
    objectType: ProviderEventObjectType,
    eventType: string,
  ): string {
    const raw = this.normalizeRequiredString(eventType, 'eventType').toLowerCase();

    if (objectType === ProviderEventObjectType.PAYOUT) {
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
        raw === 'payout.succeeded' ||
        raw === 'succeeded' ||
        raw === 'success'
      ) {
        return 'payout.paid';
      }

      if (raw === 'payout.failed' || raw === 'failed') {
        return 'payout.failed';
      }
    }

    if (objectType === ProviderEventObjectType.REFUND) {
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
        raw === 'charge.refunded' ||
        raw === 'succeeded' ||
        raw === 'success'
      ) {
        return 'refund.refunded';
      }

      if (raw === 'refund.failed' || raw === 'failed') {
        return 'refund.failed';
      }
    }

    return raw;
  }
}