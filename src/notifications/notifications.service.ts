import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { EmitNotificationDto } from './dto/emit-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { ListMyNotificationsQueryDto } from './dto/list-my-notifications-query.dto';
import { ListNotificationOutboxQueryDto } from './dto/list-notification-outbox-query.dto';
import { ProcessNotificationOutboxDto } from './dto/process-notification-outbox.dto';

type NotificationEnvelope = {
  notificationId: string;
  recipientUserId: string;
  recipientRole: string | null;
  category: string;
  severity: string;
  title: string;
  message: string;
  contextType: string | null;
  contextId: string | null;
  metadataSummary: string | null;
  createdAt: string;
};

type NotificationOutboxRow = {
  id: string;
  recipient_user_id: string | null;
  channel: string;
  status: string;
  template_key: string;
  event_type: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  scheduled_for: Date;
  sent_at: Date | null;
  failed_at: Date | null;
  cancelled_at: Date | null;
  failure_reason: string | null;
  attempt_count: number;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class NotificationsService {
  private static readonly EMIT_ACTION = 'NOTIFICATION_EMIT';
  private static readonly ACK_ACTION = 'NOTIFICATION_ACK';
  private static readonly TARGET_TYPE = 'NOTIFICATION';

  constructor(private readonly prisma: PrismaService) {}

  async emitNotification(actorUserId: string, dto: EmitNotificationDto) {
    const notificationId = randomUUID();

    await this.prisma.adminActionAudit.create({
      data: {
        action: NotificationsService.EMIT_ACTION,
        targetType: NotificationsService.TARGET_TYPE,
        targetId: notificationId,
        actorUserId,
        metadata: {
          notificationId,
          recipientUserId: dto.recipientUserId,
          recipientRole: dto.recipientRole ?? null,
          category: dto.category,
          severity: dto.severity,
          title: dto.title,
          message: dto.message,
          contextType: dto.contextType ?? null,
          contextId: dto.contextId ?? null,
          metadataSummary: dto.metadataSummary ?? null,
          createdAt: new Date().toISOString(),
        },
      },
    });

    await this.enqueueOutbox({
      recipientUserId: dto.recipientUserId,
      channel: 'IN_APP',
      templateKey: dto.category,
      eventType: `notification.${dto.category.toLowerCase()}`,
      targetType: dto.contextType ?? null,
      targetId: dto.contextId ?? null,
      payload: {
        notificationId,
        title: dto.title,
        message: dto.message,
        severity: dto.severity,
        category: dto.category,
      },
      metadata: {
        emittedBy: actorUserId,
        source: 'NOTIFICATION_EMIT',
      },
    });

    return this.getNotificationForUser(notificationId, dto.recipientUserId);
  }

  async listMyNotifications(
    userId: string,
    query: ListMyNotificationsQueryDto,
  ): Promise<PaginatedListResponseDto<NotificationResponseDto>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [emitRows, ackRows] = await Promise.all([
      this.prisma.adminActionAudit.findMany({
        where: {
          action: NotificationsService.EMIT_ACTION,
          targetType: NotificationsService.TARGET_TYPE,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 500,
      }),
      this.prisma.adminActionAudit.findMany({
        where: {
          action: NotificationsService.ACK_ACTION,
          targetType: NotificationsService.TARGET_TYPE,
          actorUserId: userId,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 500,
      }),
    ]);

    const ackMap = new Map<string, Date>();
    for (const ack of ackRows) {
      if (!ackMap.has(ack.targetId)) {
        ackMap.set(ack.targetId, ack.createdAt);
      }
    }

    let items = emitRows
      .map((row) => this.mapEmitRow(row, ackMap))
      .filter((row): row is NotificationResponseDto => row !== null)
      .filter((row) => row.recipientUserId === userId);

    if (query.category) {
      items = items.filter((row) => row.category === query.category);
    }

    if (query.severity) {
      items = items.filter((row) => row.severity === query.severity);
    }

    if (query.contextType) {
      items = items.filter((row) => row.contextType === query.contextType);
    }

    if (query.unreadOnly) {
      items = items.filter((row) => !row.isRead);
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();
      items = items.filter((row) => {
        const haystack = [
          row.notificationId,
          row.category,
          row.severity,
          row.title,
          row.message,
          row.contextType ?? '',
          row.contextId ?? '',
          String(row.metadata?.metadataSummary ?? ''),
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = items.length;
    const pagedItems = items.slice(offset, offset + limit);

    return {
      items: pagedItems,
      total,
      limit,
      offset,
      hasMore: offset + pagedItems.length < total,
    };
  }

  async acknowledgeNotification(notificationId: string, userId: string) {
    const notification = await this.getNotificationForUser(
      notificationId,
      userId,
    );

    if (notification.isRead) {
      return notification;
    }

    await this.prisma.adminActionAudit.create({
      data: {
        action: NotificationsService.ACK_ACTION,
        targetType: NotificationsService.TARGET_TYPE,
        targetId: notificationId,
        actorUserId: userId,
        metadata: {
          acknowledgedAt: new Date().toISOString(),
        },
      },
    });

    return this.getNotificationForUser(notificationId, userId);
  }

  async listOutbox(query: ListNotificationOutboxQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const q = query.q?.trim() ? `%${query.q.trim()}%` : null;

    const rows = await this.prisma.$queryRaw<NotificationOutboxRow[]>`
      SELECT *
      FROM notification_outbox
      WHERE (${query.channel ?? null}::text IS NULL OR channel = ${query.channel ?? null})
        AND (${query.status ?? null}::text IS NULL OR status = ${query.status ?? null})
        AND (${query.recipientUserId ?? null}::text IS NULL OR recipient_user_id = ${query.recipientUserId ?? null})
        AND (${query.eventType ?? null}::text IS NULL OR event_type = ${query.eventType ?? null})
        AND (${query.targetType ?? null}::text IS NULL OR target_type = ${query.targetType ?? null})
        AND (${query.targetId ?? null}::text IS NULL OR target_id = ${query.targetId ?? null})
        AND (
          ${q}::text IS NULL
          OR id ILIKE ${q}
          OR COALESCE(recipient_user_id, '') ILIKE ${q}
          OR template_key ILIKE ${q}
          OR event_type ILIKE ${q}
          OR COALESCE(target_type, '') ILIKE ${q}
          OR COALESCE(target_id, '') ILIKE ${q}
          OR status ILIKE ${q}
          OR channel ILIKE ${q}
        )
        AND (
          ${query.dueOnly ?? false}::boolean = false
          OR (status IN ('PENDING', 'FAILED') AND scheduled_for <= NOW())
        )
      ORDER BY scheduled_for ASC, created_at ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const countRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM notification_outbox
      WHERE (${query.channel ?? null}::text IS NULL OR channel = ${query.channel ?? null})
        AND (${query.status ?? null}::text IS NULL OR status = ${query.status ?? null})
        AND (${query.recipientUserId ?? null}::text IS NULL OR recipient_user_id = ${query.recipientUserId ?? null})
        AND (${query.eventType ?? null}::text IS NULL OR event_type = ${query.eventType ?? null})
        AND (${query.targetType ?? null}::text IS NULL OR target_type = ${query.targetType ?? null})
        AND (${query.targetId ?? null}::text IS NULL OR target_id = ${query.targetId ?? null})
        AND (
          ${q}::text IS NULL
          OR id ILIKE ${q}
          OR COALESCE(recipient_user_id, '') ILIKE ${q}
          OR template_key ILIKE ${q}
          OR event_type ILIKE ${q}
          OR COALESCE(target_type, '') ILIKE ${q}
          OR COALESCE(target_id, '') ILIKE ${q}
          OR status ILIKE ${q}
          OR channel ILIKE ${q}
        )
        AND (
          ${query.dueOnly ?? false}::boolean = false
          OR (status IN ('PENDING', 'FAILED') AND scheduled_for <= NOW())
        )
    `;

    const total = Number(countRows[0]?.count ?? 0);

    return {
      items: rows.map((row) => this.toOutboxResponse(row)),
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total,
    };
  }

  async processDueOutbox(dto: ProcessNotificationOutboxDto = {}) {
    const limit = dto.limit ?? 25;

    const rows = await this.prisma.$queryRaw<NotificationOutboxRow[]>`
      SELECT *
      FROM notification_outbox
      WHERE status IN ('PENDING', 'FAILED')
        AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC, created_at ASC
      LIMIT ${limit}
    `;

    const results: {
      itemId: string;
      success: boolean;
      message: string;
    }[] = [];

    for (const row of rows) {
      const processed = await this.markOutboxSent(row.id);
      results.push({
        itemId: row.id,
        success: true,
        message: processed.status,
      });
    }

    return {
      requestedCount: rows.length,
      successCount: results.length,
      failureCount: 0,
      results,
    };
  }

  async retryOutbox(notificationId: string) {
    const existing = await this.findOutbox(notificationId);

    if (!existing) {
      throw new NotFoundException('Notification outbox row not found');
    }

    if (!['FAILED', 'CANCELLED'].includes(existing.status)) {
      throw new BadRequestException(
        'Only FAILED or CANCELLED notifications can be retried',
      );
    }

    const rows = await this.prisma.$queryRaw<NotificationOutboxRow[]>`
      UPDATE notification_outbox
      SET status = 'PENDING',
          failure_reason = NULL,
          failed_at = NULL,
          cancelled_at = NULL,
          scheduled_for = NOW(),
          updated_at = NOW()
      WHERE id = ${notificationId}
      RETURNING *
    `;

    return this.toOutboxResponse(rows[0]);
  }

  async cancelOutbox(notificationId: string) {
    const existing = await this.findOutbox(notificationId);

    if (!existing) {
      throw new NotFoundException('Notification outbox row not found');
    }

    if (['SENT', 'CANCELLED'].includes(existing.status)) {
      return existing;
    }

    const rows = await this.prisma.$queryRaw<NotificationOutboxRow[]>`
      UPDATE notification_outbox
      SET status = 'CANCELLED',
          cancelled_at = NOW(),
          updated_at = NOW()
      WHERE id = ${notificationId}
      RETURNING *
    `;

    return this.toOutboxResponse(rows[0]);
  }

  private async enqueueOutbox(input: {
    recipientUserId: string | null;
    channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';
    templateKey: string;
    eventType: string;
    targetType: string | null;
    targetId: string | null;
    payload: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
  }) {
    const rows = await this.prisma.$queryRaw<NotificationOutboxRow[]>`
      INSERT INTO notification_outbox (
        id,
        recipient_user_id,
        channel,
        status,
        template_key,
        event_type,
        target_type,
        target_id,
        payload,
        metadata,
        scheduled_for
      )
      VALUES (
        ${randomUUID()},
        ${input.recipientUserId},
        ${input.channel},
        'PENDING',
        ${input.templateKey},
        ${input.eventType},
        ${input.targetType},
        ${input.targetId},
        ${JSON.stringify(input.payload)}::jsonb,
        ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb,
        NOW()
      )
      RETURNING *
    `;

    return this.toOutboxResponse(rows[0]);
  }

  private async markOutboxSent(notificationId: string) {
    const rows = await this.prisma.$queryRaw<NotificationOutboxRow[]>`
      UPDATE notification_outbox
      SET status = 'SENT',
          sent_at = NOW(),
          failed_at = NULL,
          failure_reason = NULL,
          attempt_count = attempt_count + 1,
          updated_at = NOW()
      WHERE id = ${notificationId}
      RETURNING *
    `;

    return this.toOutboxResponse(rows[0]);
  }

  private async findOutbox(notificationId: string) {
    const rows = await this.prisma.$queryRaw<NotificationOutboxRow[]>`
      SELECT *
      FROM notification_outbox
      WHERE id = ${notificationId}
      LIMIT 1
    `;

    return rows[0] ? this.toOutboxResponse(rows[0]) : null;
  }

  private async getNotificationForUser(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponseDto> {
    const [emitRows, ackRows] = await Promise.all([
      this.prisma.adminActionAudit.findMany({
        where: {
          action: NotificationsService.EMIT_ACTION,
          targetType: NotificationsService.TARGET_TYPE,
          targetId: notificationId,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 5,
      }),
      this.prisma.adminActionAudit.findMany({
        where: {
          action: NotificationsService.ACK_ACTION,
          targetType: NotificationsService.TARGET_TYPE,
          targetId: notificationId,
          actorUserId: userId,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 5,
      }),
    ]);

    const ackMap = new Map<string, Date>();
    for (const ack of ackRows) {
      if (!ackMap.has(ack.targetId)) {
        ackMap.set(ack.targetId, ack.createdAt);
      }
    }

    const notification = emitRows
      .map((row) => this.mapEmitRow(row, ackMap))
      .find((row): row is NotificationResponseDto => row !== null);

    if (!notification || notification.recipientUserId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  private mapEmitRow(
    row: {
      targetId: string;
      metadata: unknown;
      createdAt: Date;
    },
    ackMap: Map<string, Date>,
  ): NotificationResponseDto | null {
    if (!row.metadata || typeof row.metadata !== 'object') {
      return null;
    }

    const metadata = row.metadata as Record<string, unknown>;

    const envelope: NotificationEnvelope = {
      notificationId: String(metadata.notificationId ?? row.targetId),
      recipientUserId: String(metadata.recipientUserId ?? ''),
      recipientRole:
        metadata.recipientRole === null || metadata.recipientRole === undefined
          ? null
          : String(metadata.recipientRole),
      category: String(metadata.category ?? 'SYSTEM'),
      severity: String(metadata.severity ?? 'INFO'),
      title: String(metadata.title ?? ''),
      message: String(metadata.message ?? ''),
      contextType:
        metadata.contextType === null || metadata.contextType === undefined
          ? null
          : String(metadata.contextType),
      contextId:
        metadata.contextId === null || metadata.contextId === undefined
          ? null
          : String(metadata.contextId),
      metadataSummary:
        metadata.metadataSummary === null ||
        metadata.metadataSummary === undefined
          ? null
          : String(metadata.metadataSummary),
      createdAt: String(metadata.createdAt ?? row.createdAt.toISOString()),
    };

    if (!envelope.notificationId || !envelope.recipientUserId) {
      return null;
    }

    const acknowledgedAt = ackMap.get(envelope.notificationId) ?? null;

    return {
      notificationId: envelope.notificationId,
      category: envelope.category as any,
      severity: envelope.severity as any,
      title: envelope.title,
      message: envelope.message,
      recipientUserId: envelope.recipientUserId,
      recipientRole: envelope.recipientRole,
      contextType: envelope.contextType,
      contextId: envelope.contextId,
      createdAt: new Date(envelope.createdAt),
      acknowledgedAt,
      isRead: Boolean(acknowledgedAt),
      metadata: {
        metadataSummary: envelope.metadataSummary,
      },
    };
  }

  private toOutboxResponse(row: NotificationOutboxRow) {
    return {
      id: row.id,
      recipientUserId: row.recipient_user_id,
      channel: row.channel,
      status: row.status,
      templateKey: row.template_key,
      eventType: row.event_type,
      targetType: row.target_type,
      targetId: row.target_id,
      payload: row.payload ?? {},
      metadata: row.metadata ?? null,
      scheduledFor: row.scheduled_for,
      sentAt: row.sent_at,
      failedAt: row.failed_at,
      cancelledAt: row.cancelled_at,
      failureReason: row.failure_reason,
      attemptCount: row.attempt_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}