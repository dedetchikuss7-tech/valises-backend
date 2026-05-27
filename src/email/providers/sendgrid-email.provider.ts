import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider, SendEmailOptions } from '../email.interface';

@Injectable()
export class SendGridEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SendGridEmailProvider.name);
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SENDGRID_API_KEY') ?? '';
    this.fromAddress =
      this.config.get<string>('EMAIL_FROM_ADDRESS') ?? 'noreply@valises.app';
    this.fromName = this.config.get<string>('EMAIL_FROM_NAME') ?? 'Valises';
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const body = {
      personalizations: [{ to: [{ email: options.to }] }],
      from: { email: this.fromAddress, name: this.fromName },
      subject: options.subject,
      content: [
        { type: 'text/html', value: options.htmlBody },
        ...(options.textBody
          ? [{ type: 'text/plain', value: options.textBody }]
          : []),
      ],
      ...(options.unsubscribeToken
        ? {
            headers: {
              'List-Unsubscribe': `<https://api.valises.app/unsubscribe?token=${options.unsubscribeToken}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }
        : {}),
    };

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `SendGrid error: status=${response.status} body=${errorText} to=${options.to}`,
      );
      throw new Error(`SendGrid delivery failed: ${response.status}`);
    }

    this.logger.log(
      `Email sent via SendGrid: to=${options.to} subject="${options.subject}"`,
    );
  }
}
