import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationOutboxService } from './notification-outbox.service';

@Injectable()
export class NotificationOutboxScheduler {
  private readonly logger = new Logger(NotificationOutboxScheduler.name);

  constructor(
    private readonly notificationOutboxService: NotificationOutboxService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPending() {
    const result =
      await this.notificationOutboxService.processPendingBatch();
    if (result.processed > 0 || result.failed > 0) {
      this.logger.log(
        `Outbox batch: ${result.processed} processed, ${result.failed} failed`,
      );
    }
  }
}
