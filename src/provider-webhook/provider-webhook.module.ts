import { Module } from '@nestjs/common';
import { QueueProducerModule } from '../queue/queue-producer.module';
import { PayoutModule } from '../payout/payout.module';
import { RefundModule } from '../refund/refund.module';
import { TransactionModule } from '../transaction/transaction.module';
import { ProviderWebhookController } from './provider-webhook.controller';
import { ProviderWebhookService } from './provider-webhook.service';
import { ProviderWebhookSignatureService } from './provider-webhook-signature.service';

@Module({
  imports: [PayoutModule, RefundModule, TransactionModule, QueueProducerModule],
  controllers: [ProviderWebhookController],
  providers: [
    ProviderWebhookService,
    ProviderWebhookSignatureService,
  ],
  exports: [ProviderWebhookService, ProviderWebhookSignatureService],
})
export class ProviderWebhookModule {}
