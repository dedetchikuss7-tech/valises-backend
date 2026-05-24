import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProviderWebhookModule } from '../provider-webhook/provider-webhook.module';
import { NOTIFICATION_QUEUE, WEBHOOK_QUEUE } from './queue.module';
import { NotificationWorker } from './workers/notification.worker';
import { WebhookWorker } from './workers/webhook.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    ProviderWebhookModule,
    NotificationsModule,
  ],
  providers: [WebhookWorker, NotificationWorker],
})
export class QueueWorkersModule {}
