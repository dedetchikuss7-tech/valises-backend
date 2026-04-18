import { Module } from '@nestjs/common';
import { PayoutModule } from '../payout/payout.module';
import { RefundModule } from '../refund/refund.module';
import { ProviderWebhookController } from './provider-webhook.controller';

@Module({
  imports: [PayoutModule, RefundModule],
  controllers: [ProviderWebhookController],
})
export class ProviderWebhookModule {}