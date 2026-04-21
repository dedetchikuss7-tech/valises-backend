import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { EmitNotificationDto } from './dto/emit-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { ListMyNotificationsQueryDto } from './dto/list-my-notifications-query.dto';

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
    const notification = await this.getNotificationForUser(notificationId, userId);

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
        metadata.metadataSummary === null || metadata.metadataSummary === undefined
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
}