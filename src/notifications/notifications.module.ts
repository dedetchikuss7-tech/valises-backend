import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsProviderModule } from './notifications-provider.module';
import { NotificationOutboxService } from './notification-outbox.service';
import { NotificationOutboxScheduler } from './notification-outbox.scheduler';

@Module({
  imports: [PrismaModule, NotificationsProviderModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationOutboxService, NotificationOutboxScheduler],
  exports: [NotificationsService, NotificationOutboxService],
})
export class NotificationsModule {}