import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { IngestProviderWebhookEventDto } from '../provider-webhook/dto/ingest-provider-webhook-event.dto';
import { ProviderWebhookHeaders } from '../provider-webhook/provider-webhook.types';
import { NOTIFICATION_QUEUE, WEBHOOK_QUEUE } from './queue.module';
import { NOTIFICATION_JOB_PROCESS } from './workers/notification.worker';
import { WEBHOOK_JOB_PROCESS } from './workers/webhook.worker';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  async enqueueWebhook(
    dto: IngestProviderWebhookEventDto,
    headers: ProviderWebhookHeaders,
  ): Promise<{ jobId: string }> {
    const job = await this.webhookQueue.add(
      WEBHOOK_JOB_PROCESS,
      { dto, headers },
      {
        jobId: `webhook:${dto.idempotencyKey}`,
        deduplication: { id: dto.idempotencyKey },
      },
    );
    this.logger.log(
      `Webhook enqueued: jobId=${job.id} idempotencyKey=${dto.idempotencyKey}`,
    );
    return { jobId: String(job.id) };
  }

  async enqueueNotificationOutbox(limit = 25): Promise<{ jobId: string }> {
    const job = await this.notificationQueue.add(
      NOTIFICATION_JOB_PROCESS,
      { limit },
      {
        jobId: `notification-outbox:${Date.now()}`,
      },
    );
    this.logger.log(`Notification outbox job enqueued: jobId=${job.id}`);
    return { jobId: String(job.id) };
  }
}
