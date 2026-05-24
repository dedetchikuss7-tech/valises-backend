import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as sgMail from '@sendgrid/mail';
import {
  NotificationsProvider,
  SendEmailInput,
  SendEmailResult,
} from './notifications.provider';

export class SendGridProvider implements NotificationsProvider {
  private readonly logger = new Logger(SendGridProvider.name);
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;

    if (!apiKey) {
      throw new Error('SendGridProvider: missing required env var SENDGRID_API_KEY');
    }
    if (!fromEmail) {
      throw new Error('SendGridProvider: missing required env var SENDGRID_FROM_EMAIL');
    }

    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const [response] = await sgMail.send({
        to: input.recipientEmail,
        from: this.fromEmail,
        subject: input.subject,
        text: input.textContent,
        html: input.htmlContent ?? input.textContent,
      });

      const messageId =
        (response.headers?.['x-message-id'] as string | undefined) ??
        randomUUID();

      return {
        success: true,
        providerMessageId: messageId,
        sentAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `SendGrid delivery failed to=${input.recipientEmail}: ${message}`,
      );

      return {
        success: false,
        providerMessageId: null,
        sentAt: new Date().toISOString(),
        error: message,
      };
    }
  }
}
