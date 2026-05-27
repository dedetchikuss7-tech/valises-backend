import { Module } from '@nestjs/common';
import { WebhookRetryController } from './webhook-retry.controller';
import { WebhookRetryService } from './webhook-retry.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { OperationalHealthModule } from '../../operational-health/operational-health.module';

@Module({
  imports: [PrismaModule, OperationalHealthModule],
  controllers: [WebhookRetryController],
  providers: [WebhookRetryService],
  exports: [WebhookRetryService],
})
export class WebhookRetryModule {}
