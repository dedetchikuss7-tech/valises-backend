import { Controller, Get, Post, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { WebhookRetryService } from './webhook-retry.service';
import { FailedWebhooksQueryDto, WebhookStatsQueryDto } from './dto/webhook-retry.dto';

@ApiTags('admin-webhooks')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/webhooks')
export class WebhookRetryController {
  constructor(private readonly webhookRetryService: WebhookRetryService) {}

  @Get('failed')
  @ApiOperation({ summary: 'List FAILED ProviderEvents with pagination' })
  async getFailedWebhooks(@Query() query: FailedWebhooksQueryDto) {
    return this.webhookRetryService.getFailedWebhooks(query);
  }

  @Post(':id/replay')
  @ApiOperation({ summary: 'Replay a FAILED webhook (rate limited: 10/min per admin)' })
  async replayWebhook(@Param('id') eventId: string, @Req() req: any) {
    return this.webhookRetryService.replayWebhook(eventId, req.user.userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Webhook failure rate by provider over configurable window' })
  async getWebhookStats(@Query() query: WebhookStatsQueryDto) {
    return this.webhookRetryService.getWebhookStats(query);
  }
}
