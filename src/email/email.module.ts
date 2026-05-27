import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER_TOKEN } from './email.interface';
import { MockEmailProvider } from './providers/mock-email.provider';
import { SendGridEmailProvider } from './providers/sendgrid-email.provider';
import { UnsubscribeService } from './unsubscribe.service';
import { EmailTemplatesService } from './templates/email-templates.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('EMAIL_PROVIDER') ?? 'MOCK';
        if (provider === 'SENDGRID') {
          return new SendGridEmailProvider(config);
        }
        return new MockEmailProvider();
      },
      inject: [ConfigService],
    },
    UnsubscribeService,
    EmailTemplatesService,
  ],
  exports: [EMAIL_PROVIDER_TOKEN, UnsubscribeService, EmailTemplatesService],
})
export class EmailModule {}
