import { Module } from '@nestjs/common';
import { PayoutModule } from '../payout/payout.module';
import { RefundModule } from '../refund/refund.module';
import { ProviderWebhookController } from './provider-webhook.controller';
import { ProviderWebhookService } from './provider-webhook.service';
import { ProviderWebhookSignatureService } from './provider-webhook-signature.service';

@Module({
  imports: [PayoutModule, RefundModule],
  controllers: [ProviderWebhookController],
  providers: [
    ProviderWebhookService,
    ProviderWebhookSignatureService,
  ],
})
export class ProviderWebhookModule {}