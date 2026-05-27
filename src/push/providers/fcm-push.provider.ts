import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushProvider, SendPushOptions, PushResult } from '../push.interface';

@Injectable()
export class FcmPushProvider implements PushProvider {
  private readonly logger = new Logger(FcmPushProvider.name);
  private readonly serverKey: string;

  constructor(private readonly config: ConfigService) {
    this.serverKey = this.config.get<string>('FCM_SERVER_KEY') ?? '';
  }

  async sendPush(options: SendPushOptions): Promise<PushResult> {
    const body = {
      to: options.token,
      notification: {
        title: options.title,
        body: options.body,
      },
      data: options.data ?? {},
    };

    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${this.serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = (await response.json()) as any;

      if (!response.ok) {
        this.logger.error(`FCM error: status=${response.status}`);
        return { success: false, error: `HTTP ${response.status}` };
      }

      if (result.failure > 0 && result.results?.[0]?.error) {
        const fcmError = result.results[0].error;
        const unregistered =
          fcmError === 'NotRegistered' || fcmError === 'InvalidRegistration';
        this.logger.warn(
          `FCM token error: ${fcmError} token=${options.token.slice(0, 12)}...`,
        );
        return { success: false, unregistered, error: fcmError };
      }

      return { success: true };
    } catch (err: any) {
      this.logger.error(`FCM request failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
