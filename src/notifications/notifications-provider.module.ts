import { Module } from '@nestjs/common';
import { MockNotificationsProvider } from './providers/mock-notifications.provider';
import { SendGridProvider } from './providers/sendgrid.provider';
import {
  NOTIFICATIONS_PROVIDER,
  NotificationsProvider,
} from './providers/notifications.provider';

@Module({
  providers: [
    MockNotificationsProvider,
    {
      provide: NOTIFICATIONS_PROVIDER,
      useFactory: (
        mockProvider: MockNotificationsProvider,
      ): NotificationsProvider => {
        const providerName = process.env.NOTIFICATIONS_PROVIDER ?? 'MOCK';
        if (providerName === 'SENDGRID') return new SendGridProvider();
        return mockProvider;
      },
      inject: [MockNotificationsProvider],
    },
  ],
  exports: [NOTIFICATIONS_PROVIDER],
})
export class NotificationsProviderModule {}
