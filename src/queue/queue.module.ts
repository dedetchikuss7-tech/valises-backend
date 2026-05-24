import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

export const WEBHOOK_QUEUE = 'webhook-processing';
export const NOTIFICATION_QUEUE = 'notification-outbox';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PASSWORD ?? undefined,
          maxRetriesPerRequest: null,
          lazyConnect: true,
          enableReadyCheck: false,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      }),
    }),
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
