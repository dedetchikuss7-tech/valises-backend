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
import { GetAdminDashboardSummaryQueryDto } from './dto/get-admin-dashboard-summary-query.dto';
import { GetAdminDashboardQueueQueryDto } from './dto/get-admin-dashboard-queue-query.dto';
import { BulkDashboardCompleteItemsDto } from './dto/bulk-dashboard-complete-items.dto';
import { BulkDashboardMarkFailedDto } from './dto/bulk-dashboard-mark-failed.dto';
import { BulkDashboardResolveDisputesDto } from './dto/bulk-dashboard-resolve-disputes.dto';

type BulkActionResultItem = {
  id: string;
  success: boolean;
  message?: string | null;
  error?: string | null;
  result?: Record<string, unknown> | null;
};

@Injectable()
export class AdminDashboardSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payoutService: PayoutService,
    private readonly refundService: RefundService,
    private readonly disputeService: DisputeService,
  ) {}

  private normalizePreviewLimit(value?: number) {
    return Math.min(Math.max(value ?? 5, 1), 20);
  }

  private normalizeQueueLimit(value?: number) {
    return Math.min(Math.max(value ?? 20, 1), 100);
  }

  private async buildTransactionAttentionQueueData(limit: number) {
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

    const transactionAttentionMap = new Map<
      string,
      {
        transactionId: string;
        hasOpenDispute: boolean;
        hasRequestedPayout: boolean;
        hasRequestedRefund: boolean;
      }
    >();

    for (const item of openDisputeTransactionIds) {
      const current = transactionAttentionMap.get(item.transactionId) ?? {
        transactionId: item.transactionId,
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
        hasOpenDispute: false,
        hasRequestedPayout: false,
        hasRequestedRefund: false,
      };
      current.hasRequestedRefund = true;
      transactionAttentionMap.set(item.transactionId, current);
    }

    const attentionTransactionIds = Array.from(transactionAttentionMap.keys());

    if (attentionTransactionIds.length === 0) {
      return {
        totalCount: 0,
        items: [],
      };
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
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    const transactionStatusMap = new Map(
      transactions.map((item) => [item.id, item.status]),
    );

    const items = Array.from(transactionAttentionMap.values())
      .map((item) => ({
        transactionId: item.transactionId,
        status: transactionStatusMap.get(item.transactionId) ?? null,
        hasOpenDispute: item.hasOpenDispute,
        hasRequestedPayout: item.hasRequestedPayout,
        hasRequestedRefund: item.hasRequestedRefund,
      }))
      .slice(0, limit);

    return {
      totalCount: transactionAttentionMap.size,
      items,
    };
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
      transactionAttentionData,
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
      this.buildTransactionAttentionQueueData(previewLimit),
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
        transactionsRequiringAttentionCount: transactionAttentionData.totalCount,
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
      transactionsRequiringAttentionPreview: transactionAttentionData.items,
    };
  }

  async getTransactionsRequiringAttentionQueue(
    query: GetAdminDashboardQueueQueryDto,
  ) {
    const limit = this.normalizeQueueLimit(query.limit);
    const data = await this.buildTransactionAttentionQueueData(limit);
    return data.items;
  }

  async getOpenDisputesQueue(query: GetAdminDashboardQueueQueryDto) {
    const limit = this.normalizeQueueLimit(query.limit);

    return this.prisma.dispute.findMany({
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
      take: limit,
    });
  }

  async getPendingPayoutsQueue(query: GetAdminDashboardQueueQueryDto) {
    const limit = this.normalizeQueueLimit(query.limit);

    return this.prisma.payout.findMany({
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
      take: limit,
    });
  }

  async getPendingRefundsQueue(query: GetAdminDashboardQueueQueryDto) {
    const limit = this.normalizeQueueLimit(query.limit);

    return this.prisma.refund.findMany({
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
      take: limit,
    });
  }

  async getActionableReminderJobsQueue(query: GetAdminDashboardQueueQueryDto) {
    const limit = this.normalizeQueueLimit(query.limit);
    const now = new Date();

    const items = await this.prisma.reminderJob.findMany({
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
      take: limit,
    });

    return items.map((item) => ({
      id: item.id,
      abandonmentEventId: item.abandonmentEventId,
      status: item.status,
      channel: item.channel,
      scheduledFor: item.scheduledFor,
      abandonmentKind: item.abandonmentEvent?.kind ?? null,
    }));
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
}