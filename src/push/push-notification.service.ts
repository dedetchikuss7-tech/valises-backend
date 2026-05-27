import { Injectable, Logger, Inject } from '@nestjs/common';
import { PUSH_PROVIDER_TOKEN } from './push.interface';
import type { PushProvider } from './push.interface';
import { PushTemplatesService } from './push-templates.service';
import { DeviceTokenService } from './device-token.service';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    @Inject(PUSH_PROVIDER_TOKEN) private readonly pushProvider: PushProvider,
    private readonly pushTemplates: PushTemplatesService,
    private readonly deviceTokenService: DeviceTokenService,
  ) {}

  async sendToUser(
    userId: string,
    templateKey: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const tokens = await this.deviceTokenService.getTokensForUser(userId);

    if (tokens.length === 0) {
      this.logger.debug(`No device tokens for user ${userId}, skipping push`);
      return;
    }

    const template = this.pushTemplates.render(templateKey, payload);

    await Promise.allSettled(
      tokens.map(async ({ token }) => {
        const result = await this.pushProvider.sendPush({
          token,
          title: template.title,
          body: template.body,
          data: {
            templateKey,
            ...Object.fromEntries(
              Object.entries(payload).map(([k, v]) => [k, String(v)]),
            ),
          },
        });

        if (!result.success && result.unregistered) {
          this.logger.warn(
            `Removing unregistered FCM token for user ${userId}`,
          );
          await this.deviceTokenService.removeInvalidToken(token);
        }
      }),
    );
  }
}
