import { Injectable } from '@nestjs/common';
import {
  PayoutStatus,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { AdminFinancialControlsService } from '../admin-financial-controls/admin-financial-controls.service';
import { AdminFinancialControlStatus } from '../admin-financial-controls/dto/list-admin-financial-controls-query.dto';
import {
  AdminFinancialOperationObjectType,
  AdminFinancialOperationPriority,
  AdminFinancialOperationRecommendedAction,
  AdminFinancialOperationsSortBy,
  AdminFinancialOperationsSortOrder,
  ListAdminFinancialOperationsQueryDto,
} from './dto/list-admin-financial-operations-query.dto';
import { AdminFinancialOperationResponseDto } from './dto/admin-financial-operation-response.dto';
import { AdminFinancialOperationsSummaryResponseDto } from './dto/admin-financial-operations-summary-response.dto';

type QueueItem = AdminFinancialOperationResponseDto;

@Injectable()
export class AdminFinancialOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialControlsService: AdminFinancialControlsService,
  ) {}

  async getSummary(): Promise<AdminFinancialOperationsSummaryResponseDto> {
    const page = await this.listOperations({
      limit: 100,
      offset: 0,
      sortBy: AdminFinancialOperationsSortBy.PRIORITY,
      sortOrder: AdminFinancialOperationsSortOrder.DESC,
    });

    const items = page.items;

    return {
      generatedAt: new Date(),
      totalItems: items.length,
      highPriorityCount: items.filter(
        (item) => item.priority === AdminFinancialOperationPriority.HIGH,
      ).length,
      mediumPriorityCount: items.filter(
        (item) => item.priority === AdminFinancialOperationPriority.MEDIUM,
      ).length,
      lowPriorityCount: items.filter(
        (item) => item.priority === AdminFinancialOperationPriority.LOW,
      ).length,
      requiresActionCount: items.filter((item) => item.requiresAction).length,
      payoutItems: items.filter(
        (item) => item.objectType === AdminFinancialOperationObjectType.PAYOUT,
      ).length,
      refundItems: items.filter(
        (item) => item.objectType === AdminFinancialOperationObjectType.REFUND,
      ).length,
      financialControlItems: items.filter(
        (item) =>
          item.objectType ===
          AdminFinancialOperationObjectType.FINANCIAL_CONTROL,
      ).length,
    };
  }

  async listOperations(
    query: ListAdminFinancialOperationsQueryDto,
  ): Promise<PaginatedListResponseDto<QueueItem>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [payoutItems, refundItems, controlItems] = await Promise.all([
      this.loadPayoutItems(query),
      this.loadRefundItems(query),
      this.loadFinancialControlItems(query),
    ]);

    let items = [...payoutItems, ...refundItems, ...controlItems];

    if (query.objectType) {
      items = items.filter((item) => item.objectType === query.objectType);
    }

    if (query.priority) {
      items = items.filter((item) => item.priority === query.priority);
    }

    if (query.requiresAction !== undefined) {
      items = items.filter((item) => item.requiresAction === query.requiresAction);
    }

    if (query.transactionId) {
      items = items.filter((item) => item.transactionId === query.transactionId);
    }

    if (query.userId) {
      items = items.filter((item) => {
        const snapshot = item.transactionSnapshot;
        return (
          snapshot?.senderId === query.userId ||
          snapshot?.travelerId === query.userId
        );
      });
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();

      items = items.filter((item) => {
        const snapshot = item.transactionSnapshot;

        const haystack = [
          item.objectType,
          item.objectId,
          item.transactionId,
          item.status,
          item.currency,
          item.priority,
          item.recommendedAction,
          item.provider ?? '',
          item.railProvider ?? '',
          item.methodType ?? '',
          item.externalReference ?? '',
          item.failureReason ?? '',
          snapshot?.status ?? '',
          snapshot?.paymentStatus ?? '',
          snapshot?.senderId ?? '',
          snapshot?.travelerId ?? '',
          ...item.reasons,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    const sortBy = query.sortBy ?? AdminFinancialOperationsSortBy.PRIORITY;
    const sortOrder =
      query.sortOrder ?? AdminFinancialOperationsSortOrder.DESC;

    items.sort((a, b) => {
      const compare = this.compareItems(a, b, sortBy);
      return sortOrder === AdminFinancialOperationsSortOrder.ASC
        ? compare
        : -compare;
    });

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

  private async loadPayoutItems(
    query: Partial<ListAdminFinancialOperationsQueryDto>,
  ): Promise<QueueItem[]> {
    const payouts = await this.prisma.payout.findMany({
      where: {
        ...(query.transactionId ? { transactionId: query.transactionId } : {}),
        ...(query.userId
          ? {
              transaction: {
                OR: [{ senderId: query.userId }, { travelerId: query.userId }],
              },
            }
          : {}),
      },
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            escrowAmount: true,
            senderId: true,
            travelerId: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return payouts.map((payout) => {
      const classification = this.classifyPayout(payout.status);

      return {
        objectType: AdminFinancialOperationObjectType.PAYOUT,
        objectId: payout.id,
        transactionId: payout.transactionId,
        status: payout.status,
        amount: Number(payout.amount),
        currency: payout.currency,
        priority: classification.priority,
        requiresAction: classification.requiresAction,
        recommendedAction: classification.recommendedAction,
        reasons: classification.reasons,
        ageMinutes: this.computeAgeMinutes(
          payout.requestedAt ?? payout.createdAt,
        ),
        createdAt: payout.createdAt,
        updatedAt: payout.updatedAt ?? null,
        provider: payout.provider,
        railProvider: payout.railProvider ?? null,
        methodType: payout.payoutMethodType ?? null,
        externalReference: payout.externalReference ?? null,
        failureReason: payout.failureReason ?? null,
        transactionSnapshot: this.buildTransactionSnapshot(payout.transaction),
        metadata:
          payout.metadata &&
          typeof payout.metadata === 'object' &&
          !Array.isArray(payout.metadata)
            ? (payout.metadata as Record<string, unknown>)
            : null,
      };
    });
  }

  private async loadRefundItems(
    query: Partial<ListAdminFinancialOperationsQueryDto>,
  ): Promise<QueueItem[]> {
    const refunds = await this.prisma.refund.findMany({
      where: {
        ...(query.transactionId ? { transactionId: query.transactionId } : {}),
        ...(query.userId
          ? {
              transaction: {
                OR: [{ senderId: query.userId }, { travelerId: query.userId }],
              },
            }
          : {}),
      },
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            escrowAmount: true,
            senderId: true,
            travelerId: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return refunds.map((refund) => {
      const classification = this.classifyRefund(refund.status);

      return {
        objectType: AdminFinancialOperationObjectType.REFUND,
        objectId: refund.id,
        transactionId: refund.transactionId,
        status: refund.status,
        amount: Number(refund.amount),
        currency: refund.currency,
        priority: classification.priority,
        requiresAction: classification.requiresAction,
        recommendedAction: classification.recommendedAction,
        reasons: classification.reasons,
        ageMinutes: this.computeAgeMinutes(
          refund.requestedAt ?? refund.createdAt,
        ),
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt ?? null,
        provider: refund.provider,
        railProvider: null,
        methodType: null,
        externalReference: refund.externalReference ?? null,
        failureReason: refund.failureReason ?? null,
        transactionSnapshot: this.buildTransactionSnapshot(refund.transaction),
        metadata:
          refund.metadata &&
          typeof refund.metadata === 'object' &&
          !Array.isArray(refund.metadata)
            ? (refund.metadata as Record<string, unknown>)
            : null,
      };
    });
  }

  private async loadFinancialControlItems(
    query: Partial<ListAdminFinancialOperationsQueryDto>,
  ): Promise<QueueItem[]> {
    const controlsPage = await this.financialControlsService.listControls({
      transactionId: query.transactionId,
      userId: query.userId,
      requiresAction: true,
      limit: 100,
      offset: 0,
    });

    return controlsPage.items.map((control) => {
      const classification = this.classifyFinancialControl(
        control.derivedStatus,
      );

      return {
        objectType: AdminFinancialOperationObjectType.FINANCIAL_CONTROL,
        objectId: control.transactionId,
        transactionId: control.transactionId,
        status: control.derivedStatus,
        amount: Number(control.transactionAmount),
        currency: control.currency,
        priority: classification.priority,
        requiresAction: classification.requiresAction,
        recommendedAction: classification.recommendedAction,
        reasons: [
          ...classification.reasons,
          ...control.mismatchSignals.map((signal) => `CONTROL_${signal}`),
        ],
        ageMinutes: this.computeAgeMinutes(
          control.updatedAt ?? control.createdAt,
        ),
        createdAt: control.createdAt,
        updatedAt: control.updatedAt ?? null,
        provider: null,
        railProvider: null,
        methodType: null,
        externalReference: null,
        failureReason: null,
        transactionSnapshot: {
          id: control.transactionId,
          status: control.transactionStatus,
          paymentStatus: control.paymentStatus,
          escrowAmount: control.remainingEscrowAmount,
          senderId: control.senderId,
          travelerId: control.travelerId,
          currency: control.currency,
        },
        metadata: {
          ledgerCreditedAmount: control.ledgerCreditedAmount,
          ledgerReleasedAmount: control.ledgerReleasedAmount,
          ledgerRefundedAmount: control.ledgerRefundedAmount,
          payoutPaidAmount: control.payoutPaidAmount,
          refundPaidAmount: control.refundPaidAmount,
          remainingEscrowAmount: control.remainingEscrowAmount,
          lastAdminActionAt: control.lastAdminActionAt,
          lastAdminActionBy: control.lastAdminActionBy,
          lastAdminActionType: control.lastAdminActionType,
          adminActionCount: control.adminActionCount,
        },
      };
    });
  }

  private classifyPayout(status: PayoutStatus): {
    priority: AdminFinancialOperationPriority;
    requiresAction: boolean;
    recommendedAction: AdminFinancialOperationRecommendedAction;
    reasons: string[];
  } {
    if (status === PayoutStatus.FAILED) {
      return {
        priority: AdminFinancialOperationPriority.HIGH,
        requiresAction: true,
        recommendedAction:
          AdminFinancialOperationRecommendedAction.RETRY_PAYOUT,
        reasons: ['PAYOUT_FAILED', 'MANUAL_REVIEW_REQUIRED'],
      };
    }

    if (status === PayoutStatus.REQUESTED) {
      return {
        priority: AdminFinancialOperationPriority.MEDIUM,
        requiresAction: true,
        recommendedAction:
          AdminFinancialOperationRecommendedAction.PROCESS_PAYOUT,
        reasons: ['PAYOUT_REQUESTED', 'WAITING_PROCESSING'],
      };
    }

    if (status === PayoutStatus.PROCESSING) {
      return {
        priority: AdminFinancialOperationPriority.MEDIUM,
        requiresAction: true,
        recommendedAction:
          AdminFinancialOperationRecommendedAction.MONITOR_PAYOUT,
        reasons: ['PAYOUT_PROCESSING', 'WAITING_PROVIDER_CONFIRMATION'],
      };
    }

    return {
      priority: AdminFinancialOperationPriority.LOW,
      requiresAction: false,
      recommendedAction:
        AdminFinancialOperationRecommendedAction.NO_ACTION_REQUIRED,
      reasons: [`PAYOUT_${status}`],
    };
  }

  private classifyRefund(status: RefundStatus): {
    priority: AdminFinancialOperationPriority;
    requiresAction: boolean;
    recommendedAction: AdminFinancialOperationRecommendedAction;
    reasons: string[];
  } {
    if (status === RefundStatus.FAILED) {
      return {
        priority: AdminFinancialOperationPriority.HIGH,
        requiresAction: true,
        recommendedAction:
          AdminFinancialOperationRecommendedAction.RETRY_REFUND,
        reasons: ['REFUND_FAILED', 'MANUAL_REVIEW_REQUIRED'],
      };
    }

    if (status === RefundStatus.REQUESTED) {
      return {
        priority: AdminFinancialOperationPriority.MEDIUM,
        requiresAction: true,
        recommendedAction:
          AdminFinancialOperationRecommendedAction.PROCESS_REFUND,
        reasons: ['REFUND_REQUESTED', 'WAITING_PROCESSING'],
      };
    }

    if (status === RefundStatus.PROCESSING) {
      return {
        priority: AdminFinancialOperationPriority.MEDIUM,
        requiresAction: true,
        recommendedAction:
          AdminFinancialOperationRecommendedAction.MONITOR_REFUND,
        reasons: ['REFUND_PROCESSING', 'WAITING_PROVIDER_CONFIRMATION'],
      };
    }

    return {
      priority: AdminFinancialOperationPriority.LOW,
      requiresAction: false,
      recommendedAction:
        AdminFinancialOperationRecommendedAction.NO_ACTION_REQUIRED,
      reasons: [`REFUND_${status}`],
    };
  }

  private classifyFinancialControl(status: AdminFinancialControlStatus): {
    priority: AdminFinancialOperationPriority;
    requiresAction: boolean;
    recommendedAction: AdminFinancialOperationRecommendedAction;
    reasons: string[];
  } {
    if (status === AdminFinancialControlStatus.BREACH) {
      return {
        priority: AdminFinancialOperationPriority.HIGH,
        requiresAction: true,
        recommendedAction:
          AdminFinancialOperationRecommendedAction.REVIEW_FINANCIAL_CONTROL,
        reasons: ['FINANCIAL_CONTROL_BREACH'],
      };
    }

    if (status === AdminFinancialControlStatus.WARNING) {
      return {
        priority: AdminFinancialOperationPriority.MEDIUM,
        requiresAction: true,
        recommendedAction:
          AdminFinancialOperationRecommendedAction.REVIEW_FINANCIAL_CONTROL,
        reasons: ['FINANCIAL_CONTROL_WARNING'],
      };
    }

    return {
      priority: AdminFinancialOperationPriority.LOW,
      requiresAction: false,
      recommendedAction:
        AdminFinancialOperationRecommendedAction.NO_ACTION_REQUIRED,
      reasons: ['FINANCIAL_CONTROL_CLEAN'],
    };
  }

  private buildTransactionSnapshot(transaction: any) {
    if (!transaction) {
      return null;
    }

    return {
      id: transaction.id,
      status: transaction.status,
      paymentStatus: transaction.paymentStatus,
      escrowAmount: Number(transaction.escrowAmount ?? 0),
      senderId: transaction.senderId ?? null,
      travelerId: transaction.travelerId ?? null,
      currency: transaction.currency,
    };
  }

  private computeAgeMinutes(date: Date): number {
    const diffMs = Date.now() - date.getTime();
    return Math.max(0, Math.floor(diffMs / 60_000));
  }

  private compareItems(
    a: QueueItem,
    b: QueueItem,
    sortBy: AdminFinancialOperationsSortBy,
  ): number {
    switch (sortBy) {
      case AdminFinancialOperationsSortBy.CREATED_AT:
        return a.createdAt.getTime() - b.createdAt.getTime();

      case AdminFinancialOperationsSortBy.UPDATED_AT:
        return (
          (a.updatedAt ?? a.createdAt).getTime() -
          (b.updatedAt ?? b.createdAt).getTime()
        );

      case AdminFinancialOperationsSortBy.AGE_MINUTES:
        return a.ageMinutes - b.ageMinutes;

      case AdminFinancialOperationsSortBy.AMOUNT:
        return a.amount - b.amount;

      case AdminFinancialOperationsSortBy.PRIORITY:
      default:
        return this.priorityRank(a.priority) - this.priorityRank(b.priority);
    }
  }

  private priorityRank(priority: AdminFinancialOperationPriority): number {
    if (priority === AdminFinancialOperationPriority.HIGH) {
      return 3;
    }

    if (priority === AdminFinancialOperationPriority.MEDIUM) {
      return 2;
    }

    return 1;
  }
}