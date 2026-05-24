import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NOTIFICATION_QUEUE, WEBHOOK_QUEUE } from './queue.module';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueProducerModule {}
