import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '../../notifications/notifications.service';
import { NOTIFICATION_QUEUE } from '../queue.module';

export const NOTIFICATION_JOB_PROCESS = 'process-outbox';

@Processor(NOTIFICATION_QUEUE, {
  concurrency: parseInt(process.env.BULL_NOTIFICATION_CONCURRENCY ?? '2', 10),
})
export class NotificationWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<{ limit?: number }>): Promise<unknown> {
    const limit = job.data?.limit ?? 25;
    this.logger.log(`Processing notification outbox job: id=${job.id} limit=${limit}`);
    return this.notificationsService.processDueOutbox({ limit });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Notification job failed: id=${job.id} attempts=${job.attemptsMade} error=${error.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Notification job completed: id=${job.id}`);
  }
}
