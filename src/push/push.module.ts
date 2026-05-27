import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PUSH_PROVIDER_TOKEN } from './push.interface';
import { MockPushProvider } from './providers/mock-push.provider';
import { FcmPushProvider } from './providers/fcm-push.provider';
import { PushTemplatesService } from './push-templates.service';
import { DeviceTokenService } from './device-token.service';
import { PushNotificationService } from './push-notification.service';
import { DeviceTokenController } from './device-token.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [DeviceTokenController],
  providers: [
    {
      provide: PUSH_PROVIDER_TOKEN,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('PUSH_PROVIDER') ?? 'MOCK';
        if (provider === 'FCM') {
          return new FcmPushProvider(config);
        }
        return new MockPushProvider();
      },
      inject: [ConfigService],
    },
    PushTemplatesService,
    DeviceTokenService,
    PushNotificationService,
  ],
  exports: [PushNotificationService, DeviceTokenService],
})
export class PushModule {}
