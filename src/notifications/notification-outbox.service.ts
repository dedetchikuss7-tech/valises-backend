import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPayload } from './notification-events';
import { renderNotificationText } from './notification-templates';
import { EMAIL_PROVIDER_TOKEN } from '../email/email.interface';
import type { EmailProvider } from '../email/email.interface';
import { EmailTemplatesService } from '../email/templates/email-templates.service';
import { UnsubscribeService } from '../email/unsubscribe.service';
import { PushNotificationService } from '../push/push-notification.service';

const MAX_ATTEMPTS = 2;

@Injectable()
export class NotificationOutboxService {
  private readonly logger = new Logger(NotificationOutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly emailProvider: EmailProvider,
    private readonly emailTemplates: EmailTemplatesService,
    private readonly unsubscribeService: UnsubscribeService,
    @Optional() private readonly pushNotificationService?: PushNotificationService,
  ) {}

  private get notificationsEnabled(): boolean {
    return process.env.NOTIFICATIONS_ENABLED === 'true';
  }

  /**
   * Inserts IN_APP + EMAIL rows in the outbox with per-channel idempotency.
   * Key: notification:{eventType}:{entityId}:{channel}
   * If either key already exists → skip silently.
   */
  async enqueue(
    payload: NotificationPayload,
  ): Promise<{ queued: boolean; skipped: boolean }> {
    if (!this.notificationsEnabled) {
      this.logger.debug(
        `Notifications disabled — skipping ${payload.eventType}:${payload.entityId}`,
      );
      return { queued: false, skipped: true };
    }

    const baseKey = `notification:${payload.eventType}:${payload.entityId}`;
    const inAppKey = `${baseKey}:IN_APP`;
    const emailKey = `${baseKey}:EMAIL`;
    const message = renderNotificationText(payload.eventType, payload.data ?? {});

    const existing = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM notification_outbox
      WHERE metadata->>'idempotency_key' = ${inAppKey}
         OR metadata->>'idempotency_key' = ${emailKey}
      LIMIT 1
    `;

    if (existing.length > 0) {
      this.logger.debug(
        `Notification already queued — skipping: ${baseKey}`,
      );
      return { queued: false, skipped: true };
    }

    const inAppMetadata = JSON.stringify({
      idempotency_key: inAppKey,
      ...(payload.data ?? {}),
    });

    await this.prisma.$executeRaw`
      INSERT INTO notification_outbox (
        id, recipient_user_id, channel, status, template_key, event_type,
        target_type, target_id, payload, metadata, scheduled_for
      )
      VALUES (
        ${randomUUID()},
        ${payload.recipientId},
        'IN_APP',
        'PENDING',
        ${payload.eventType.toLowerCase()},
        ${payload.eventType},
        'NOTIFICATION_EVENT',
        ${payload.entityId},
        ${JSON.stringify({ message })}::jsonb,
        ${inAppMetadata}::jsonb,
        NOW()
      )
    `;

    const emailMetadata = JSON.stringify({
      idempotency_key: emailKey,
      ...(payload.data ?? {}),
    });

    await this.prisma.$executeRaw`
      INSERT INTO notification_outbox (
        id, recipient_user_id, channel, status, template_key, event_type,
        target_type, target_id, payload, metadata, scheduled_for
      )
      VALUES (
        ${randomUUID()},
        ${payload.recipientId},
        'EMAIL',
        'PENDING',
        ${payload.eventType.toLowerCase()},
        ${payload.eventType},
        'NOTIFICATION_EVENT',
        ${payload.entityId},
        ${JSON.stringify({ message })}::jsonb,
        ${emailMetadata}::jsonb,
        NOW()
      )
    `;

    this.logger.log(`Notification queued (IN_APP + EMAIL): ${baseKey}`);
    return { queued: true, skipped: false };
  }

  /**
   * Processes PENDING outbox entries. Dispatches by channel:
   * - EMAIL → dispatchEmail() via real provider
   * - IN_APP (and others) → log and mark SENT
   * Max 2 attempts — after failure → status FAILED.
   */
  async processPendingBatch(
    limit = 50,
  ): Promise<{ processed: number; failed: number }> {
    if (!this.notificationsEnabled) return { processed: 0, failed: 0 };

    const pending = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM notification_outbox
      WHERE status = 'PENDING' AND attempt_count < ${MAX_ATTEMPTS}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;

    let processed = 0;
    let failed = 0;

    for (const notification of pending) {
      try {
        await this.prisma.$executeRaw`
          UPDATE notification_outbox
          SET status = 'PROCESSING',
              attempt_count = attempt_count + 1,
              updated_at = NOW()
          WHERE id = ${notification.id}
        `;

        if (notification.channel === 'EMAIL') {
          await this.dispatchEmail(notification);
        } else if (notification.channel === 'PUSH') {
          await this.dispatchPush(notification);
        } else {
          this.logger.log(
            `[NOTIFICATION] ${notification.event_type} → user:${notification.recipient_user_id} — ${(notification.payload as any)?.message ?? ''}`,
          );
        }

        await this.prisma.$executeRaw`
          UPDATE notification_outbox
          SET status = 'SENT',
              sent_at = NOW(),
              updated_at = NOW()
          WHERE id = ${notification.id}
        `;
        processed++;
      } catch (err) {
        this.logger.error(
          `Notification processing failed for ${notification.id}`,
          err,
        );

        await this.prisma.$executeRaw`
          UPDATE notification_outbox
          SET status = CASE WHEN attempt_count >= ${MAX_ATTEMPTS} THEN 'FAILED' ELSE 'PENDING' END,
              failed_at = CASE WHEN attempt_count >= ${MAX_ATTEMPTS} THEN NOW() ELSE NULL END,
              updated_at = NOW()
          WHERE id = ${notification.id}
        `;
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Returns notifications in DLQ (FAILED after MAX_ATTEMPTS).
   */
  async getDeadLetterQueue(): Promise<any[]> {
    return this.prisma.$queryRaw<any[]>`
      SELECT * FROM notification_outbox
      WHERE status = 'FAILED'
      ORDER BY failed_at DESC
      LIMIT 100
    `;
  }

  private async dispatchPush(entry: any): Promise<void> {
    if (!this.pushNotificationService) {
      this.logger.debug('PushNotificationService not available, skipping PUSH dispatch');
      return;
    }
    const payload = entry.payload as Record<string, any>;
    await this.pushNotificationService.sendToUser(
      entry.recipient_user_id,
      entry.template_key,
      payload,
    );
  }

  private async dispatchEmail(entry: any): Promise<void> {
    const payload = entry.payload as Record<string, any>;
    const templateKey = entry.template_key as string;
    const recipientUserId = entry.recipient_user_id as string;

    const user = await this.prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { email: true },
    });

    if (!user?.email) {
      this.logger.warn(
        `No email for user ${recipientUserId}, skipping outbox entry ${entry.id}`,
      );
      return;
    }

    const unsubscribeToken = this.unsubscribeService.generateToken(recipientUserId);
    const template = this.emailTemplates.render(templateKey, payload, unsubscribeToken);

    await this.emailProvider.sendEmail({
      to: user.email,
      subject: template.subject,
      htmlBody: template.html,
      textBody: template.text,
      unsubscribeToken,
    });
  }
}
