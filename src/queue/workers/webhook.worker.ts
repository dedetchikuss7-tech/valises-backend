import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IngestProviderWebhookEventDto } from '../../provider-webhook/dto/ingest-provider-webhook-event.dto';
import { ProviderWebhookService } from '../../provider-webhook/provider-webhook.service';
import { ProviderWebhookHeaders } from '../../provider-webhook/provider-webhook.types';
import { WEBHOOK_QUEUE } from '../queue.module';

export const WEBHOOK_JOB_PROCESS = 'process-webhook';

@Processor(WEBHOOK_QUEUE, {
  concurrency: parseInt(process.env.BULL_WEBHOOK_CONCURRENCY ?? '3', 10),
})
export class WebhookWorker extends WorkerHost {
  private readonly logger = new Logger(WebhookWorker.name);

  constructor(private readonly webhookService: ProviderWebhookService) {
    super();
  }

  async process(job: Job<{ dto: IngestProviderWebhookEventDto; headers: ProviderWebhookHeaders }>): Promise<unknown> {
    const { dto, headers } = job.data;
    this.logger.log(
      `Processing webhook job: id=${job.id} provider=${dto?.provider} idempotencyKey=${dto?.idempotencyKey}`,
    );
    return this.webhookService.handleIncomingEvent(dto, headers);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Webhook job failed: id=${job.id} attempts=${job.attemptsMade} error=${error.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Webhook job completed: id=${job.id}`);
  }
}
