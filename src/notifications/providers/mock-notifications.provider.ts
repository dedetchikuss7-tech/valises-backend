import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  NotificationsProvider,
  SendEmailInput,
  SendEmailResult,
} from './notifications.provider';

@Injectable()
export class MockNotificationsProvider implements NotificationsProvider {
  private readonly logger = new Logger(MockNotificationsProvider.name);

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    this.logger.log(
      `[MOCK] sendEmail to=${input.recipientEmail} subject="${input.subject}" templateKey=${input.templateKey}`,
    );

    return {
      success: true,
      providerMessageId: `mock-${randomUUID()}`,
      sentAt: new Date().toISOString(),
    };
  }
}
