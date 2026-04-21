import { Injectable } from '@nestjs/common';
import {
  AdminActionAudit,
  AmlCaseStatus,
  BehaviorRestrictionStatus,
  DisputeStatus,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityFeedItemResponseDto } from './dto/activity-feed-item-response.dto';
import {
  ActivityFeedSeverity,
  ActivityFeedSourceType,
  ListActivityFeedQueryDto,
} from './dto/list-activity-feed-query.dto';

@Injectable()
export class ActivityFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyFeed(userId: string, query: ListActivityFeedQueryDto) {
    return this.buildFeed({
      query,
      userId,
      adminMode: false,
    });
  }

  async listAdminFeed(query: ListActivityFeedQueryDto) {
    return this.buildFeed({
      query,
      userId: query.userId ?? null,
      adminMode: true,
    });
  }

  private async buildFeed(params: {
    query: ListActivityFeedQueryDto;
    userId: string | null;
    adminMode: boolean;
  }): Promise<ActivityFeedItemResponseDto[]> {
    const { query, userId, adminMode } = params;

    const [
      transactionItems,
      disputeItems,
      amlItems,
      restrictionItems,
      payoutItems,
      refundItems,
      notificationItems,
      caseManagementItems,
    ] = await Promise.all([
      this.loadTransactionItems(query, userId, adminMode),
      this.loadDisputeItems(query, userId, adminMode),
      this.loadAmlItems(query, userId, adminMode),
      this.loadRestrictionItems(query, userId, adminMode),
      this.loadPayoutItems(query, userId, adminMode),
      this.loadRefundItems(query, userId, adminMode),
      this.loadNotificationItems(query, userId, adminMode),
      this.loadCaseManagementItems(query, userId, adminMode),
    ]);

    let items = [
      ...transactionItems,
      ...disputeItems,
      ...amlItems,
      ...restrictionItems,
      ...payoutItems,
      ...refundItems,
      ...notificationItems,
      ...caseManagementItems,
    ];

    if (query.sourceType) {
      items = items.filter((item) => item.sourceType === query.sourceType);
    }

    if (query.severity) {
        items = items.filter((item) => item.severity === query.severity);
    }

    const includeSystem = query.includeSystem ?? true;

    if (!includeSystem) {
        items = items.filter(
            (item) =>
                item.sourceType !== ActivityFeedSourceType.NOTIFICATION &&
                item.sourceType !== ActivityFeedSourceType.CASE_MANAGEMENT,
         );
    }

    items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return items.slice(0, query.limit ?? 20);
  }

  private async loadTransactionItems(
    query: ListActivityFeedQueryDto,
    userId: string | null,
    adminMode: boolean,
  ): Promise<ActivityFeedItemResponseDto[]> {
    const where: any = {};

    if (query.transactionId) {
      where.id = query.transactionId;
    }

    if (userId) {
      where.OR = [{ senderId: userId }, { travelerId: userId }];
    }

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        senderId: true,
        travelerId: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        updatedAt: true,
        amount: true,
        currency: true,
      },
    });

    return rows.map((row) => ({
      eventId: `tx:${row.id}:${row.updatedAt?.toISOString() ?? row.createdAt.toISOString()}`,
      sourceType: ActivityFeedSourceType.TRANSACTION,
      sourceAction: row.status,
      severity:
        row.status === TransactionStatus.DISPUTED ||
        row.paymentStatus === PaymentStatus.FAILED
          ? ActivityFeedSeverity.WARNING
          : ActivityFeedSeverity.INFO,
      occurredAt: row.updatedAt ?? row.createdAt,
      actorUserId: null,
      subjectUserId: row.senderId,
      secondaryUserId: row.travelerId,
      transactionId: row.id,
      title: `Transaction ${row.status}`,
      message: `Payment status: ${row.paymentStatus}`,
      metadata: {
        amount: row.amount,
        currency: row.currency,
      },
    }));
  }

  private async loadDisputeItems(
    query: ListActivityFeedQueryDto,
    userId: string | null,
    adminMode: boolean,
  ): Promise<ActivityFeedItemResponseDto[]> {
    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (userId) {
      where.OR = [
        { openedById: userId },
        { transaction: { senderId: userId } },
        { transaction: { travelerId: userId } },
      ];
    }

    const rows = await this.prisma.dispute.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      include: {
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      eventId: `dispute:${row.id}:${row.updatedAt.toISOString()}`,
      sourceType: ActivityFeedSourceType.DISPUTE,
      sourceAction: row.status,
      severity:
        row.status === DisputeStatus.OPEN
          ? ActivityFeedSeverity.WARNING
          : ActivityFeedSeverity.INFO,
      occurredAt: row.updatedAt,
      actorUserId: row.openedById,
      subjectUserId: row.transaction?.senderId ?? null,
      secondaryUserId: row.transaction?.travelerId ?? null,
      transactionId: row.transactionId,
      title: `Dispute ${row.reasonCode}`,
      message: row.reason ?? null,
      metadata: {
        openingSource: row.openingSource,
        evidenceStatus: row.evidenceStatus,
      },
    }));
  }

  private async loadAmlItems(
    query: ListActivityFeedQueryDto,
    userId: string | null,
    adminMode: boolean,
  ): Promise<ActivityFeedItemResponseDto[]> {
    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (userId) {
      where.OR = [{ senderId: userId }, { travelerId: userId }];
    }

    const rows = await this.prisma.amlCase.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });

    return rows.map((row) => ({
      eventId: `aml:${row.id}:${row.updatedAt.toISOString()}`,
      sourceType: ActivityFeedSourceType.AML,
      sourceAction: row.currentAction,
      severity:
        row.status === AmlCaseStatus.OPEN
          ? ActivityFeedSeverity.WARNING
          : ActivityFeedSeverity.INFO,
      occurredAt: row.updatedAt,
      actorUserId: row.reviewedById ?? null,
      subjectUserId: row.senderId,
      secondaryUserId: row.travelerId,
      transactionId: row.transactionId,
      title: `AML ${row.currentAction}`,
      message: row.reasonSummary ?? null,
      metadata: {
        riskLevel: row.riskLevel,
        signalCount: row.signalCount,
      },
    }));
  }

  private async loadRestrictionItems(
    query: ListActivityFeedQueryDto,
    userId: string | null,
    adminMode: boolean,
  ): Promise<ActivityFeedItemResponseDto[]> {
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    const rows = await this.prisma.behaviorRestriction.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { imposedAt: 'desc' }],
      take: 100,
    });

    return rows.map((row) => ({
      eventId: `restriction:${row.id}:${row.updatedAt.toISOString()}`,
      sourceType: ActivityFeedSourceType.RESTRICTION,
      sourceAction: row.status,
      severity:
        row.status === BehaviorRestrictionStatus.ACTIVE
          ? ActivityFeedSeverity.WARNING
          : ActivityFeedSeverity.INFO,
      occurredAt: row.updatedAt,
      actorUserId: row.imposedById ?? row.releasedById ?? null,
      subjectUserId: row.userId,
      secondaryUserId: null,
      transactionId: null,
      title: `Restriction ${row.kind}`,
      message: row.reasonSummary ?? null,
      metadata: {
        scope: row.scope,
        reasonCode: row.reasonCode,
      },
    }));
  }

  private async loadPayoutItems(
    query: ListActivityFeedQueryDto,
    userId: string | null,
    adminMode: boolean,
  ): Promise<ActivityFeedItemResponseDto[]> {
    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (userId) {
      where.transaction = {
        OR: [{ senderId: userId }, { travelerId: userId }],
      };
    }

    const rows = await this.prisma.payout.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      include: {
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      eventId: `payout:${row.id}:${row.updatedAt.toISOString()}`,
      sourceType: ActivityFeedSourceType.PAYOUT,
      sourceAction: row.status,
      severity:
        row.status === PayoutStatus.FAILED
          ? ActivityFeedSeverity.CRITICAL
          : row.status === PayoutStatus.REQUESTED ||
              row.status === PayoutStatus.PROCESSING
            ? ActivityFeedSeverity.WARNING
            : ActivityFeedSeverity.INFO,
      occurredAt: row.updatedAt,
      actorUserId: null,
      subjectUserId: row.transaction?.senderId ?? null,
      secondaryUserId: row.transaction?.travelerId ?? null,
      transactionId: row.transactionId,
      title: `Payout ${row.status}`,
      message: row.failureReason ?? null,
      metadata: {
        provider: row.provider,
        amount: row.amount,
        currency: row.currency,
      },
    }));
  }

  private async loadRefundItems(
    query: ListActivityFeedQueryDto,
    userId: string | null,
    adminMode: boolean,
  ): Promise<ActivityFeedItemResponseDto[]> {
    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (userId) {
      where.transaction = {
        OR: [{ senderId: userId }, { travelerId: userId }],
      };
    }

    const rows = await this.prisma.refund.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      include: {
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      eventId: `refund:${row.id}:${row.updatedAt.toISOString()}`,
      sourceType: ActivityFeedSourceType.REFUND,
      sourceAction: row.status,
      severity:
        row.status === RefundStatus.FAILED
          ? ActivityFeedSeverity.CRITICAL
          : row.status === RefundStatus.REQUESTED ||
              row.status === RefundStatus.PROCESSING
            ? ActivityFeedSeverity.WARNING
            : ActivityFeedSeverity.INFO,
      occurredAt: row.updatedAt,
      actorUserId: null,
      subjectUserId: row.transaction?.senderId ?? null,
      secondaryUserId: row.transaction?.travelerId ?? null,
      transactionId: row.transactionId,
      title: `Refund ${row.status}`,
      message: row.failureReason ?? null,
      metadata: {
        provider: row.provider,
        amount: row.amount,
        currency: row.currency,
      },
    }));
  }

  private async loadNotificationItems(
    query: ListActivityFeedQueryDto,
    userId: string | null,
    adminMode: boolean,
  ): Promise<ActivityFeedItemResponseDto[]> {
    const rows = await this.prisma.adminActionAudit.findMany({
      where: {
        action: 'NOTIFICATION_EMIT',
        ...(query.transactionId
          ? {
              metadata: {
                path: ['contextId'],
                equals: query.transactionId,
              },
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });

    return rows
      .map((row) => {
        const metadata =
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : null;

        if (!metadata) {
          return null;
        }

        const recipientUserId =
          metadata.recipientUserId === undefined || metadata.recipientUserId === null
            ? null
            : String(metadata.recipientUserId);

        if (!adminMode && userId && recipientUserId !== userId) {
          return null;
        }

        return {
          eventId: `notification:${row.targetId}:${row.createdAt.toISOString()}`,
          sourceType: ActivityFeedSourceType.NOTIFICATION,
          sourceAction: 'NOTIFICATION_EMIT',
          severity:
            String(metadata.severity ?? 'INFO') === 'CRITICAL'
              ? ActivityFeedSeverity.CRITICAL
              : String(metadata.severity ?? 'INFO') === 'WARNING'
                ? ActivityFeedSeverity.WARNING
                : ActivityFeedSeverity.INFO,
          occurredAt: row.createdAt,
          actorUserId: row.actorUserId ?? null,
          subjectUserId: recipientUserId,
          secondaryUserId: null,
          transactionId:
            metadata.contextType === 'TRANSACTION' && metadata.contextId
              ? String(metadata.contextId)
              : null,
          title: String(metadata.title ?? 'Notification'),
          message: String(metadata.message ?? ''),
          metadata,
        } as ActivityFeedItemResponseDto;
      })
      .filter((row): row is ActivityFeedItemResponseDto => row !== null);
  }

  private async loadCaseManagementItems(
    query: ListActivityFeedQueryDto,
    userId: string | null,
    adminMode: boolean,
  ): Promise<ActivityFeedItemResponseDto[]> {
    const rows = await this.prisma.adminActionAudit.findMany({
      where: {
        action: {
          in: ['CASE_OPEN', 'CASE_TAKE', 'CASE_RELEASE', 'CASE_RESOLVE', 'CASE_NOTE'],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });

    return rows
      .map((row) => {
        const metadata =
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {};

        const subjectUserId =
          metadata.subjectUserId === undefined || metadata.subjectUserId === null
            ? null
            : String(metadata.subjectUserId);

        const secondaryUserId =
          metadata.secondaryUserId === undefined || metadata.secondaryUserId === null
            ? null
            : String(metadata.secondaryUserId);

        const transactionId =
          metadata.transactionId === undefined || metadata.transactionId === null
            ? null
            : String(metadata.transactionId);

        if (!adminMode && userId && subjectUserId !== userId && secondaryUserId !== userId) {
          return null;
        }

        if (query.transactionId && transactionId !== query.transactionId) {
          return null;
        }

        return {
          eventId: `case:${row.id}`,
          sourceType: ActivityFeedSourceType.CASE_MANAGEMENT,
          sourceAction: row.action,
          severity:
            row.action === 'CASE_RESOLVE'
              ? ActivityFeedSeverity.INFO
              : ActivityFeedSeverity.WARNING,
          occurredAt: row.createdAt,
          actorUserId: row.actorUserId ?? null,
          subjectUserId,
          secondaryUserId,
          transactionId,
          title:
            typeof metadata.title === 'string'
              ? metadata.title
              : `Case action ${row.action}`,
          message:
            typeof metadata.note === 'string'
              ? metadata.note
              : null,
          metadata,
        } as ActivityFeedItemResponseDto;
      })
      .filter((row): row is ActivityFeedItemResponseDto => row !== null);
  }
}