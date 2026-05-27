import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NOTIFICATION_QUEUE, WEBHOOK_QUEUE } from '../queue/queue.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationalHealthController } from './operational-health.controller';
import { OperationalHealthService } from './operational-health.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  controllers: [OperationalHealthController],
  providers: [OperationalHealthService],
  exports: [OperationalHealthService],
})
export class OperationalHealthModule {}
