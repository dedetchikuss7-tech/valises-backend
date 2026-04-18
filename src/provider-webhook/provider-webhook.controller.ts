import {
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
import { Public } from '../auth/public.decorator';
import { IngestProviderWebhookEventDto } from './dto/ingest-provider-webhook-event.dto';
import { ProviderWebhookService } from './provider-webhook.service';

@ApiTags('Provider Webhooks')
@Controller('provider-webhooks')
export class ProviderWebhookController {
  constructor(
    private readonly providerWebhookService: ProviderWebhookService,
  ) {}

  @Public()
  @Post('events')
  @ApiOperation({
    summary: 'Public provider webhook ingestion boundary',
    description:
      'Public, signature-ready webhook entrypoint. It accepts a normalized provider event plus webhook transport metadata from headers, then routes to payout or refund provider-event ingestion through a dedicated webhook service.',
  })
  @ApiHeader({
    name: 'x-provider-signature',
    required: false,
    description:
      'Raw provider signature header. Used by the webhook hardening foundation.',
  })
  @ApiHeader({
    name: 'x-provider-delivery-id',
    required: false,
    description:
      'Provider delivery identifier when available.',
  })
  @ApiHeader({
    name: 'x-provider-timestamp',
    required: false,
    description:
      'Provider timestamp header when available.',
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
    return this.providerWebhookService.handleIncomingEvent(dto, {
      signature,
      deliveryId,
      providerTimestamp,
    });
  }
}