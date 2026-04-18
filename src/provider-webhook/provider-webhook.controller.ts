import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  PayoutProvider,
  ProviderEventObjectType,
  RefundProvider,
} from '@prisma/client';
import { Public } from '../auth/public.decorator';
import { PayoutService } from '../payout/payout.service';
import { RefundService } from '../refund/refund.service';
import { IngestProviderWebhookEventDto } from './dto/ingest-provider-webhook-event.dto';

@ApiTags('Provider Webhooks')
@Controller('provider-webhooks')
export class ProviderWebhookController {
  constructor(
    private readonly payoutService: PayoutService,
    private readonly refundService: RefundService,
  ) {}

  @Public()
  @Post('events')
  @ApiOperation({
    summary: 'Public provider webhook ingestion boundary',
    description:
      'Public, signature-ready webhook entrypoint. It accepts a normalized provider event plus webhook transport metadata from headers, then routes to payout or refund provider-event ingestion.',
  })
  @ApiHeader({
    name: 'x-provider-signature',
    required: false,
    description:
      'Raw provider signature header. Stored in payload metadata for future signature verification hardening.',
  })
  @ApiHeader({
    name: 'x-provider-delivery-id',
    required: false,
    description:
      'Provider delivery identifier when available. Useful for tracing and future replay protection.',
  })
  @ApiHeader({
    name: 'x-provider-timestamp',
    required: false,
    description:
      'Provider timestamp header when available. Useful for future signature verification.',
  })
  @ApiBody({ type: IngestProviderWebhookEventDto })
  @ApiOkResponse({
    description: 'Provider event accepted and routed to payout or refund flow',
  })
  async ingestEvent(
    @Body() dto: IngestProviderWebhookEventDto,
    @Headers('x-provider-signature') signature?: string,
    @Headers('x-provider-delivery-id') deliveryId?: string,
    @Headers('x-provider-timestamp') providerTimestamp?: string,
  ) {
    const payload = {
      ...(dto.payload ?? {}),
      _webhook: {
        receivedAt: new Date().toISOString(),
        signature: signature ?? null,
        deliveryId: deliveryId ?? null,
        providerTimestamp: providerTimestamp ?? null,
        signatureVerificationStatus: 'NOT_IMPLEMENTED_YET',
      },
    };

    if (dto.objectType === ProviderEventObjectType.PAYOUT) {
      return this.payoutService.ingestProviderEvent({
        provider: dto.provider as PayoutProvider,
        eventType: dto.eventType,
        idempotencyKey: dto.idempotencyKey,
        payoutId: dto.payoutId ?? null,
        transactionId: dto.transactionId ?? null,
        externalReference: dto.externalReference ?? null,
        occurredAt: dto.occurredAt ?? null,
        payload,
        actorUserId: null,
      });
    }

    if (dto.objectType === ProviderEventObjectType.REFUND) {
      return this.refundService.ingestProviderEvent({
        provider: dto.provider as RefundProvider,
        eventType: dto.eventType,
        idempotencyKey: dto.idempotencyKey,
        refundId: dto.refundId ?? null,
        transactionId: dto.transactionId ?? null,
        externalReference: dto.externalReference ?? null,
        occurredAt: dto.occurredAt ?? null,
        payload,
        actorUserId: null,
      });
    }

    throw new BadRequestException(
      `Unsupported provider webhook objectType: ${dto.objectType}`,
    );
  }
}