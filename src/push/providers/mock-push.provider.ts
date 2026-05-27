import { Injectable, Logger } from '@nestjs/common';
import { PushProvider, SendPushOptions, PushResult } from '../push.interface';

@Injectable()
export class MockPushProvider implements PushProvider {
  private readonly logger = new Logger(MockPushProvider.name);

  async sendPush(options: SendPushOptions): Promise<PushResult> {
    this.logger.log(
      `[MOCK PUSH] token=${options.token.slice(0, 12)}... title="${options.title}" body="${options.body}"`,
    );
    return { success: true };
  }
}
