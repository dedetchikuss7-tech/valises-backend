import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { PushModule } from '../push/push.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsProviderModule } from './notifications-provider.module';
import { NotificationOutboxService } from './notification-outbox.service';
import { NotificationOutboxScheduler } from './notification-outbox.scheduler';
import { NotificationsAdminController } from './notifications-admin.controller';
import { UnsubscribeController } from './unsubscribe.controller';

@Module({
  imports: [PrismaModule, NotificationsProviderModule, EmailModule, PushModule],
  controllers: [
    NotificationsController,
    NotificationsAdminController,
    UnsubscribeController,
  ],
  providers: [NotificationsService, NotificationOutboxService, NotificationOutboxScheduler],
  exports: [NotificationsService, NotificationOutboxService],
})
export class NotificationsModule {}
