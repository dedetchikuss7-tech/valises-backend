import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, SendEmailOptions } from '../email.interface';

@Injectable()
export class MockEmailProvider implements EmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);

  async sendEmail(options: SendEmailOptions): Promise<void> {
    this.logger.log(
      `[MOCK EMAIL] to=${options.to} subject="${options.subject}" unsubscribeToken=${options.unsubscribeToken ?? 'none'}`,
    );
  }
}
