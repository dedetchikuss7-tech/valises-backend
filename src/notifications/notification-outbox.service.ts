import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPayload } from './notification-events';
import { renderNotificationText } from './notification-templates';

const MAX_ATTEMPTS = 2;

@Injectable()
export class NotificationOutboxService {
  private readonly logger = new Logger(NotificationOutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get notificationsEnabled(): boolean {
    return process.env.NOTIFICATIONS_ENABLED === 'true';
  }

  /**
   * Insère une notification dans l'outbox avec idempotency.
   * Clé : notification:{eventType}:{entityId} — stockée dans metadata.
   * Si la clé existe déjà → skip silencieux.
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

    const idempotencyKey = `notification:${payload.eventType}:${payload.entityId}`;
    const message = renderNotificationText(payload.eventType, payload.data ?? {});

    const existing = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM notification_outbox
      WHERE metadata->>'idempotency_key' = ${idempotencyKey}
      LIMIT 1
    `;

    if (existing.length > 0) {
      this.logger.debug(
        `Notification already queued — skipping: ${idempotencyKey}`,
      );
      return { queued: false, skipped: true };
    }

    const metadataJson = JSON.stringify({
      idempotency_key: idempotencyKey,
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
        ${metadataJson}::jsonb,
        NOW()
      )
    `;

    this.logger.log(`Notification queued: ${idempotencyKey}`);
    return { queued: true, skipped: false };
  }

  /**
   * Traite les notifications PENDING de l'outbox.
   * Max 2 tentatives — après échec → DLQ (status FAILED).
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

        this.logger.log(
          `[NOTIFICATION] ${notification.event_type} → user:${notification.recipient_user_id} — ${(notification.payload as any)?.message ?? ''}`,
        );

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
   * Retourne les notifications en DLQ (FAILED après MAX_ATTEMPTS).
   */
  async getDeadLetterQueue(): Promise<any[]> {
    return this.prisma.$queryRaw<any[]>`
      SELECT * FROM notification_outbox
      WHERE status = 'FAILED'
      ORDER BY failed_at DESC
      LIMIT 100
    `;
  }
}
