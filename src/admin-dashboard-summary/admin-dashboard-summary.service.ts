import { Injectable } from '@nestjs/common';
import {
  AbandonmentEventStatus,
  DisputeStatus,
  PayoutStatus,
  RefundStatus,
  ReminderJobStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutService } from '../payout/payout.service';
import { RefundService } from '../refund/refund.service';
import { DisputeService } from '../dispute/dispute.service';
import { AdminAbandonmentService } from '../admin-abandonment/admin-abandonment.service';
import { GetAdminDashboardSummaryQueryDto } from './dto/get-admin-dashboard-summary-query.dto';
import { GetAdminDashboardActivityQueryDto } from './dto/get-admin-dashboard-activity-query.dto';
import { GetAdminDashboardTransactionAttentionQueryDto } from './dto/get-admin-dashboard-transaction-attention-query.dto';
import { GetAdminDashboardOpenDisputesQueryDto } from './dto/get-admin-dashboard-open-disputes-query.dto';
import { GetAdminDashboardPayoutsQueryDto } from './dto/get-admin-dashboard-payouts-query.dto';
import { GetAdminDashboardRefundsQueryDto } from './dto/get-admin-dashboard-refunds-query.dto';
import { GetAdminDashboardReminderJobsQueryDto } from './dto/get-admin-dashboard-reminder-jobs-query.dto';
import { BulkDashboardCompleteItemsDto } from './dto/bulk-dashboard-complete-items.dto';
import { BulkDashboardItemIdsDto } from './dto/bulk-dashboard-item-ids.dto';
import { BulkDashboardMarkFailedDto } from './dto/bulk-dashboard-mark-failed.dto';
import { BulkDashboardResolveDisputesDto } from './dto/bulk-dashboard-resolve-disputes.dto';
import { AdminDashboardPageResult } from './dto/admin-dashboard-page-result.interface';

type BulkActionResultItem = {
  id: string;
  success: boolean;
  message?: string | null;
  error?: string | null;
  result?: Record<string, unknown> | null;
};

type TransactionAttentionItem = {
  transactionId: string;
  status: string | null;
  hasOpenDispute: boolean;
  hasRequestedPayout: boolean;
  hasRequestedRefund: boolean;
};

type EnrichedActivityItem = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  targetLabel: string | null;
  resultSummary: string | null;
  isBulkAction: boolean;
  batchSize: number | null;
  successCount: number | null;
  failureCount: number | null;
};

@Injectable()
export class AdminDashboardSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payoutService: PayoutService,
    private readonly refundService: RefundService,
    private readonly disputeService: DisputeService,
    private readonly adminAbandonmentService: AdminAbandonmentService,
  ) {}

  private normalizePreviewLimit(value?: number) {
    return Math.min(Math.max(value ?? 5, 1), 20);
  }

  private normalizeLimit(value?: number) {
    return Math.min(Math.max(value ?? 20, 1), 100);
  }

  private normalizeOffset(value?: number) {
    return Math.max(value ?? 0, 0);
  }

  private buildPage<T>(
    items: T[],
    limit?: number,
    offset?: number,
  ): AdminDashboardPageResult<T> {
    const safeLimit = this.normalizeLimit(limit);
    const safeOffset = this.normalizeOffset(offset);
    const total = items.length;
    const pageItems = items.slice(safeOffset, safeOffset + safeLimit);

    return {
      items: pageItems,
      count: pageItems.length,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + safeLimit < total,
    };
  }

  private applySortOrder<T>(
    items: T[],
    compareFn: (a: T, b: T) => number,
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const sorted = [...items].sort(compareFn);
    return sortOrder === 'asc' ? sorted : sorted.reverse();
  }

  private parseMetadata(
    metadata: unknown,
  ): Record<string, unknown> | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }
    return metadata as Record<string, unknown>;
  }

  private readNullableNumber(
    metadata: Record<string, unknown> | null,
    key: string,
  ): number | null {
    const value = metadata?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private buildTargetLabel(
    targetType: string | null,
    targetId: string | null,
  ): string | null {
    if (targetType && targetId) {
      return `${targetType} ${targetId}`;
    }
    if (targetType) {
      return targetType;
    }
    if (targetId) {
      return targetId;
    }
    return null;
  }

  private buildResultSummary(
    metadata: Record<string, unknown> | null,
    successCount: number | null,
    failureCount: number | null,
  ): string | null {
    const explicitSummary = metadata?.resultSummary;
    if (typeof explicitSummary === 'string' && explicitSummary.trim()) {
      return explicitSummary;
    }

    if (successCount !== null || failureCount !== null) {
      const successPart =
        successCount !== null ? `${successCount} succeeded` : null;
      const failurePart =
        failureCount !== null ? `${failureCount} failed` : null;

      return [successPart, failurePart].filter(Boolean).join(', ') || null;
    }

    const status = metadata?.status;
    if (typeof status === 'string' && status.trim()) {
      return `Status: ${status}`;
    }

    const action = metadata?.action;
    if (typeof action === 'string' && action.trim()) {
      return action;
    }

    return null;
  }

  private enrichActivityItem(item: {
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    actorUserId: string | null;
    metadata: unknown;
    createdAt: Date;
  }): EnrichedActivityItem {
    const metadata = this.parseMetadata(item.metadata);
    const requestedCount = this.readNullableNumber(metadata, 'requestedCount');
    const batchSize =
      requestedCount ?? this.readNullableNumber(metadata, 'batchSize');
    const successCount = this.readNullableNumber(metadata, 'successCount');
    const failureCount = this.readNullableNumber(metadata, 'failureCount');
    const isBulkAction =
      batchSize !== null ||
      item.action.endsWith('_MANY') ||
      item.action.includes('BULK');

    return {
      id: item.id,
      action: item.action,
      targetType: item.targetType,
      targetId: item.targetId,
      actorUserId: item.actorUserId,
      metadata,
      createdAt: item.createdAt,
      targetLabel: this.buildTargetLabel(item.targetType, item.targetId),
      resultSummary: this.buildResultSummary(
        metadata,
        successCount,
        failureCount,
      ),
      isBulkAction,
      batchSize,
      successCount,
      failureCount,
    };
  }

  private async buildTransactionAttentionQueueItems(): Promise<
    TransactionAttentionItem[]
  > {
    const [
      openDisputeTransactionIds,
      requestedOrProcessingPayoutTransactionIds,
      requestedOrProcessingRefundTransactionIds,
    ] = await Promise.all([
      this.prisma.dispute.findMany({
        where: { status: DisputeStatus.OPEN },
        select: { transactionId: true },
      }),
      this.prisma.payout.findMany({
        where: {
          status: { in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] },
        },
        select: { transactionId: true },
      }),
      this.prisma.refund.findMany({
        where: {
          status: { in: [RefundStatus.REQUESTED, RefundStatus.PROCESSING] },
        },
        select: { transactionId: true },
      }),
    ]);

    const transactionAttentionMap = new Map<string, TransactionAttentionItem>();

    for (const item of openDisputeTransactionIds) {
      const current = transactionAttentionMap.get(item.transactionId) ?? {
        transactionId: item.transactionId,
        status: null,
        hasOpenDispute: false,
        hasRequestedPayout: false,
        hasRequestedRefund: false,
      };
      current.hasOpenDispute = true;
      transactionAttentionMap.set(item.transactionId, current);
    }

    for (const item of requestedOrProcessingPayoutTransactionIds) {
      const current = transactionAttentionMap.get(item.transactionId) ?? {
        transactionId: item.transactionId,
        status: null,
        hasOpenDispute: false,
        hasRequestedPayout: false,
        hasRequestedRefund: false,
      };
      current.hasRequestedPayout = true;
      transactionAttentionMap.set(item.transactionId, current);
    }

    for (const item of requestedOrProcessingRefundTransactionIds) {
      const current = transactionAttentionMap.get(item.transactionId) ?? {
        transactionId: item.transactionId,
        status: null,
        hasOpenDispute: false,
        hasRequestedPayout: false,
        hasRequestedRefund: false,
      };
      current.hasRequestedRefund = true;
      transactionAttentionMap.set(item.transactionId, current);
    }

    const attentionTransactionIds = Array.from(transactionAttentionMap.keys());

    if (attentionTransactionIds.length === 0) {
      return [];
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        id: {
          in: attentionTransactionIds,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    const transactionStatusMap = new Map(
      transactions.map((item) => [item.id, item.status]),
    );

    return Array.from(transactionAttentionMap.values()).map((item) => ({
      ...item,
      status: transactionStatusMap.get(item.transactionId) ?? null,
    }));
  }

  async getSummary(query: GetAdminDashboardSummaryQueryDto) {
    const previewLimit = this.normalizePreviewLimit(query.previewLimit);
    const now = new Date();

    const [
      openDisputesCount,
      requestedPayoutsCount,
      processingPayoutsCount,
      requestedRefundsCount,
      processingRefundsCount,
      activeAbandonmentEventsCount,
      actionableReminderJobsCount,
      recentOpenDisputes,
      pendingPayouts,
      pendingRefunds,
      actionableReminderJobs,
      transactionAttentionItems,
    ] = await Promise.all([
      this.prisma.dispute.count({
        where: { status: DisputeStatus.OPEN },
      }),
      this.prisma.payout.count({
        where: { status: PayoutStatus.REQUESTED },
      }),
      this.prisma.payout.count({
        where: { status: PayoutStatus.PROCESSING },
      }),
      this.prisma.refund.count({
        where: { status: RefundStatus.REQUESTED },
      }),
      this.prisma.refund.count({
        where: { status: RefundStatus.PROCESSING },
      }),
      this.prisma.abandonmentEvent.count({
        where: { status: AbandonmentEventStatus.ACTIVE },
      }),
      this.prisma.reminderJob.count({
        where: {
          abandonmentEvent: {
            status: AbandonmentEventStatus.ACTIVE,
          },
          OR: [
            {
              status: ReminderJobStatus.PENDING,
              scheduledFor: { lte: now },
            },
            { status: ReminderJobStatus.FAILED },
            { status: ReminderJobStatus.CANCELLED },
          ],
        },
      }),
      this.prisma.dispute.findMany({
        where: { status: DisputeStatus.OPEN },
        select: {
          id: true,
          transactionId: true,
          reasonCode: true,
          openingSource: true,
          status: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: previewLimit,
      }),
      this.prisma.payout.findMany({
        where: {
          status: { in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] },
        },
        select: {
          id: true,
          transactionId: true,
          status: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: previewLimit,
      }),
      this.prisma.refund.findMany({
        where: {
          status: { in: [RefundStatus.REQUESTED, RefundStatus.PROCESSING] },
        },
        select: {
          id: true,
          transactionId: true,
          status: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: previewLimit,
      }),
      this.prisma.reminderJob.findMany({
        where: {
          abandonmentEvent: {
            status: AbandonmentEventStatus.ACTIVE,
          },
          OR: [
            {
              status: ReminderJobStatus.PENDING,
              scheduledFor: { lte: now },
            },
            { status: ReminderJobStatus.FAILED },
            { status: ReminderJobStatus.CANCELLED },
          ],
        },
        select: {
          id: true,
          abandonmentEventId: true,
          status: true,
          channel: true,
          scheduledFor: true,
          abandonmentEvent: {
            select: {
              kind: true,
            },
          },
        },
        orderBy: [{ scheduledFor: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
        take: previewLimit,
      }),
      this.buildTransactionAttentionQueueItems(),
    ]);

    return {
      serverTime: now.toISOString(),
      previewLimit,
      counts: {
        openDisputesCount,
        requestedPayoutsCount,
        processingPayoutsCount,
        requestedRefundsCount,
        processingRefundsCount,
        transactionsRequiringAttentionCount: transactionAttentionItems.length,
        activeAbandonmentEventsCount,
        actionableReminderJobsCount,
      },
      recentOpenDisputes,
      pendingPayouts,
      pendingRefunds,
      actionableReminderJobs: actionableReminderJobs.map((item) => ({
        id: item.id,
        abandonmentEventId: item.abandonmentEventId,
        status: item.status,
        channel: item.channel,
        scheduledFor: item.scheduledFor,
        abandonmentKind: item.abandonmentEvent?.kind ?? null,
      })),
      transactionsRequiringAttentionPreview: transactionAttentionItems.slice(
        0,
        previewLimit,
      ),
    };
  }

  async getActivity(
    query: GetAdminDashboardActivityQueryDto,
  ): Promise<AdminDashboardPageResult<EnrichedActivityItem>> {
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    };

    const total = await this.prisma.adminActionAudit.count({ where });

    const rows = await this.prisma.adminActionAudit.findMany({
      where,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        actorUserId: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
      take: limit,
      skip: offset,
    });

    const items = rows.map((row) => this.enrichActivityItem(row));

    return {
      items,
      count: items.length,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async getTransactionsRequiringAttentionQueue(
    query: GetAdminDashboardTransactionAttentionQueryDto,
  ): Promise<AdminDashboardPageResult<TransactionAttentionItem>> {
    let items = await this.buildTransactionAttentionQueueItems();

    if (query.hasOpenDispute !== undefined) {
      const expected = query.hasOpenDispute === 'true';
      items = items.filter((item) => item.hasOpenDispute === expected);
    }

    if (query.hasRequestedPayout !== undefined) {
      const expected = query.hasRequestedPayout === 'true';
      items = items.filter((item) => item.hasRequestedPayout === expected);
    }

    if (query.hasRequestedRefund !== undefined) {
      const expected = query.hasRequestedRefund === 'true';
      items = items.filter((item) => item.hasRequestedRefund === expected);
    }

    const sortBy = query.sortBy ?? 'transactionId';
    const sortOrder = query.sortOrder ?? 'asc';

    items = this.applySortOrder(
      items,
      (a, b) => {
        if (sortBy === 'status') {
          return (a.status ?? '').localeCompare(b.status ?? '');
        }
        return a.transactionId.localeCompare(b.transactionId);
      },
      sortOrder,
    );

    return this.buildPage(items, query.limit, query.offset);
  }

  async getOpenDisputesQueue(
    query: GetAdminDashboardOpenDisputesQueryDto,
  ): Promise<AdminDashboardPageResult<any>> {
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where = {
      status: DisputeStatus.OPEN,
      ...(query.reasonCode ? { reasonCode: query.reasonCode } : {}),
      ...(query.openingSource ? { openingSource: query.openingSource } : {}),
    };

    const total = await this.prisma.dispute.count({ where });

    const items = await this.prisma.dispute.findMany({
      where,
      select: {
        id: true,
        transactionId: true,
        reasonCode: true,
        openingSource: true,
        status: true,
        createdAt: true,
      },
      orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
      take: limit,
      skip: offset,
    });

    return {
      items,
      count: items.length,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async getPendingPayoutsQueue(
    query: GetAdminDashboardPayoutsQueryDto,
  ): Promise<AdminDashboardPageResult<any>> {
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where = {
      status: query.status
        ? query.status
        : { in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] },
      ...(query.currency ? { currency: query.currency } : {}),
    };

    const total = await this.prisma.payout.count({ where });

    const items = await this.prisma.payout.findMany({
      where,
      select: {
        id: true,
        transactionId: true,
        status: true,
        amount: true,
        currency: true,
        createdAt: true,
      },
      orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
      take: limit,
      skip: offset,
    });

    return {
      items,
      count: items.length,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async getPendingRefundsQueue(
    query: GetAdminDashboardRefundsQueryDto,
  ): Promise<AdminDashboardPageResult<any>> {
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where = {
      status: query.status
        ? query.status
        : { in: [RefundStatus.REQUESTED, RefundStatus.PROCESSING] },
      ...(query.currency ? { currency: query.currency } : {}),
    };

    const total = await this.prisma.refund.count({ where });

    const items = await this.prisma.refund.findMany({
      where,
      select: {
        id: true,
        transactionId: true,
        status: true,
        amount: true,
        currency: true,
        createdAt: true,
      },
      orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
      take: limit,
      skip: offset,
    });

    return {
      items,
      count: items.length,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async getActionableReminderJobsQueue(
    query: GetAdminDashboardReminderJobsQueryDto,
  ): Promise<AdminDashboardPageResult<any>> {
    const now = new Date();
    const sortBy = query.sortBy ?? 'scheduledFor';
    const sortOrder = query.sortOrder ?? 'asc';

    let items = await this.prisma.reminderJob.findMany({
      where: {
        abandonmentEvent: {
          status: AbandonmentEventStatus.ACTIVE,
        },
        OR: [
          {
            status: ReminderJobStatus.PENDING,
            scheduledFor: { lte: now },
          },
          { status: ReminderJobStatus.FAILED },
          { status: ReminderJobStatus.CANCELLED },
        ],
        ...(query.channel ? { channel: query.channel } : {}),
      },
      select: {
        id: true,
        abandonmentEventId: true,
        status: true,
        channel: true,
        scheduledFor: true,
        abandonmentEvent: {
          select: {
            kind: true,
          },
        },
      },
    });

    if (query.status) {
      items = items.filter((item) => item.status === query.status);
    }

    items = this.applySortOrder(
      items,
      (a, b) => {
        if (sortBy === 'status') {
          return a.status.localeCompare(b.status);
        }
        if (sortBy === 'channel') {
          return a.channel.localeCompare(b.channel);
        }
        return a.scheduledFor.getTime() - b.scheduledFor.getTime();
      },
      sortOrder,
    );

    const mappedItems = items.map((item) => ({
      id: item.id,
      abandonmentEventId: item.abandonmentEventId,
      status: item.status,
      channel: item.channel,
      scheduledFor: item.scheduledFor,
      abandonmentKind: item.abandonmentEvent?.kind ?? null,
    }));

    return this.buildPage(mappedItems, query.limit, query.offset);
  }

  private buildBulkResult(results: BulkActionResultItem[]) {
    const successCount = results.filter((item) => item.success).length;
    const failureCount = results.length - successCount;

    return {
      requestedCount: results.length,
      successCount,
      failureCount,
      results: results.map((item) => ({
        id: item.id,
        success: item.success,
        message: item.message ?? null,
        error: item.error ?? null,
        result: item.result ?? null,
      })),
    };
  }

  async bulkMarkPayoutsPaid(
    dto: BulkDashboardCompleteItemsDto,
    actorUserId: string,
  ) {
    const results: BulkActionResultItem[] = [];

    for (const id of dto.ids) {
      try {
        const result = await this.payoutService.markPaid(id, {
          externalReference: dto.externalReference ?? null,
          note: dto.note ?? null,
          actorUserId,
        });

        results.push({
          id,
          success: true,
          message: 'Payout marked as paid',
          result: { status: (result as any)?.status ?? null },
        });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error?.message ?? 'Unknown error',
        });
      }
    }

    return this.buildBulkResult(results);
  }

  async bulkMarkPayoutsFailed(
    dto: BulkDashboardMarkFailedDto,
    actorUserId: string,
  ) {
    const results: BulkActionResultItem[] = [];

    for (const id of dto.ids) {
      try {
        const result = await this.payoutService.markFailed(id, {
          reason: dto.reason,
          actorUserId,
        });

        results.push({
          id,
          success: true,
          message: 'Payout marked as failed',
          result: { status: (result as any)?.status ?? null },
        });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error?.message ?? 'Unknown error',
        });
      }
    }

    return this.buildBulkResult(results);
  }

  async bulkMarkRefundsRefunded(
    dto: BulkDashboardCompleteItemsDto,
    actorUserId: string,
  ) {
    const results: BulkActionResultItem[] = [];

    for (const id of dto.ids) {
      try {
        const result = await this.refundService.markRefunded(id, {
          externalReference: dto.externalReference ?? null,
          note: dto.note ?? null,
          actorUserId,
        });

        results.push({
          id,
          success: true,
          message: 'Refund marked as refunded',
          result: { status: (result as any)?.status ?? null },
        });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error?.message ?? 'Unknown error',
        });
      }
    }

    return this.buildBulkResult(results);
  }

  async bulkMarkRefundsFailed(
    dto: BulkDashboardMarkFailedDto,
    actorUserId: string,
  ) {
    const results: BulkActionResultItem[] = [];

    for (const id of dto.ids) {
      try {
        const result = await this.refundService.markFailed(id, {
          reason: dto.reason,
          actorUserId,
        });

        results.push({
          id,
          success: true,
          message: 'Refund marked as failed',
          result: { status: (result as any)?.status ?? null },
        });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error?.message ?? 'Unknown error',
        });
      }
    }

    return this.buildBulkResult(results);
  }

  async bulkResolveDisputes(
    dto: BulkDashboardResolveDisputesDto,
    actorUserId: string,
  ) {
    const results: BulkActionResultItem[] = [];

    for (const id of dto.ids) {
      try {
        const result = await this.disputeService.resolve(id, {
          decidedById: actorUserId,
          outcome: dto.outcome as any,
          evidenceLevel: dto.evidenceLevel as any,
          refundAmount: dto.refundAmount,
          releaseAmount: dto.releaseAmount,
          notes: dto.notes,
        });

        results.push({
          id,
          success: true,
          message: 'Dispute resolved',
          result: {
            payoutId: (result as any)?.payout?.id ?? null,
            refundId: (result as any)?.refund?.id ?? null,
          },
        });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error?.message ?? 'Unknown error',
        });
      }
    }

    return this.buildBulkResult(results);
  }

  async bulkTriggerReminderJobs(dto: BulkDashboardItemIdsDto) {
    const results: BulkActionResultItem[] = [];

    for (const id of dto.ids) {
      try {
        const result = await this.adminAbandonmentService.triggerReminderJob(id);

        results.push({
          id,
          success: true,
          message: 'Reminder job triggered',
          result: {
            action: (result as any)?.action ?? null,
            status: (result as any)?.item?.status ?? null,
          },
        });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error?.message ?? 'Unknown error',
        });
      }
    }

    return this.buildBulkResult(results);
  }

  async bulkCancelReminderJobs(dto: BulkDashboardItemIdsDto) {
    const results: BulkActionResultItem[] = [];

    for (const id of dto.ids) {
      try {
        const result = await this.adminAbandonmentService.cancelReminderJob(id);

        results.push({
          id,
          success: true,
          message: 'Reminder job cancelled',
          result: {
            action: (result as any)?.action ?? null,
            status: (result as any)?.item?.status ?? null,
          },
        });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error?.message ?? 'Unknown error',
        });
      }
    }

    return this.buildBulkResult(results);
  }

  async bulkRetryReminderJobs(dto: BulkDashboardItemIdsDto) {
    const results: BulkActionResultItem[] = [];

    for (const id of dto.ids) {
      try {
        const result = await this.adminAbandonmentService.retryReminderJob(id);

        results.push({
          id,
          success: true,
          message: 'Reminder job retried',
          result: {
            action: (result as any)?.action ?? null,
            status: (result as any)?.item?.status ?? null,
          },
        });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error?.message ?? 'Unknown error',
        });
      }
    }

    return this.buildBulkResult(results);
  }
}