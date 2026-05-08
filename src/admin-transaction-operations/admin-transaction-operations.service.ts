import { Injectable } from '@nestjs/common';
import {
  BehaviorRestrictionStatus,
  DisputeStatus,
  EvidenceAttachmentStatus,
  EvidenceAttachmentObjectType,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import {
  AdminTransactionOperationItemDto,
  TransactionOperationalSeverity,
  TransactionRecommendedAction,
} from './dto/admin-transaction-operation-item.dto';
import {
  AdminTransactionOperationsQueryDto,
  AdminTransactionOperationsSortBy,
  SortOrder,
} from './dto/admin-transaction-operations-query.dto';
import { AdminTransactionOperationsSummaryDto } from './dto/admin-transaction-operations-summary.dto';

@Injectable()
export class AdminTransactionOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listQueue(
    query: AdminTransactionOperationsQueryDto,
  ): Promise<PaginatedListResponseDto<AdminTransactionOperationItemDto>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const rows = await this.loadRows();

    let items = rows;

    if (query.transactionStatus) {
      items = items.filter(
        (item) => item.transactionStatus === query.transactionStatus,
      );
    }

    if (query.paymentStatus) {
      items = items.filter((item) => item.paymentStatus === query.paymentStatus);
    }

    if (query.operationalSeverity) {
      items = items.filter(
        (item) => item.operationalSeverity === query.operationalSeverity,
      );
    }

    if (query.recommendedAction) {
      items = items.filter(
        (item) => item.recommendedAction === query.recommendedAction,
      );
    }

    if (query.requiresAdminAttention !== undefined) {
      items = items.filter(
        (item) =>
          item.requiresAdminAttention === query.requiresAdminAttention,
      );
    }

    if (query.hasOpenDispute !== undefined) {
      items = items.filter(
        (item) => item.hasOpenDispute === query.hasOpenDispute,
      );
    }

    if (query.hasPendingEvidenceReview !== undefined) {
      items = items.filter(
        (item) =>
          item.hasPendingEvidenceReview === query.hasPendingEvidenceReview,
      );
    }

    if (query.hasPendingRefund !== undefined) {
      items = items.filter(
        (item) => item.hasPendingRefund === query.hasPendingRefund,
      );
    }

    if (query.hasPendingPayout !== undefined) {
      items = items.filter(
        (item) => item.hasPendingPayout === query.hasPendingPayout,
      );
    }

    if (query.hasActiveRestriction !== undefined) {
      items = items.filter(
        (item) => item.hasActiveRestriction === query.hasActiveRestriction,
      );
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();

      items = items.filter((item) => {
        const haystack = [
          item.transactionId,
          item.senderId,
          item.travelerId,
          item.packageId ?? '',
          item.tripId ?? '',
          item.corridorId ?? '',
          item.transactionStatus,
          item.paymentStatus,
          item.operationalSeverity,
          item.recommendedAction,
          ...item.reasons,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    this.sortItems(items, query.sortBy, query.sortOrder);

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

  async getSummary(): Promise<AdminTransactionOperationsSummaryDto> {
    const items = await this.loadRows();

    return {
      generatedAt: new Date(),
      totalRows: items.length,
      highSeverityCount: items.filter(
        (item) => item.operationalSeverity === TransactionOperationalSeverity.HIGH,
      ).length,
      mediumSeverityCount: items.filter(
        (item) =>
          item.operationalSeverity === TransactionOperationalSeverity.MEDIUM,
      ).length,
      lowSeverityCount: items.filter(
        (item) => item.operationalSeverity === TransactionOperationalSeverity.LOW,
      ).length,
      requiresAdminAttentionCount: items.filter(
        (item) => item.requiresAdminAttention,
      ).length,
      openDisputeCount: items.filter((item) => item.hasOpenDispute).length,
      pendingEvidenceReviewCount: items.filter(
        (item) => item.hasPendingEvidenceReview,
      ).length,
      pendingPayoutCount: items.filter((item) => item.hasPendingPayout).length,
      pendingRefundCount: items.filter((item) => item.hasPendingRefund).length,
      activeRestrictionCount: items.filter((item) => item.hasActiveRestriction)
        .length,
    };
  }

  private async loadRows(): Promise<AdminTransactionOperationItemDto[]> {
    const [transactions, pendingEvidence, activeRestrictions] =
      await Promise.all([
        this.prisma.transaction.findMany({
          orderBy: [{ updatedAt: 'desc' }],
          take: 500,
          include: {
            disputes: {
              orderBy: [{ createdAt: 'desc' }],
              take: 1,
              select: {
                id: true,
                status: true,
              },
            },
            payout: {
              select: {
                id: true,
                status: true,
              },
            },
            refund: {
              select: {
                id: true,
                status: true,
              },
            },
            amlCase: {
              select: {
                id: true,
                currentAction: true,
                status: true,
              },
            },
          },
        }),
        this.prisma.evidenceAttachment.findMany({
          where: {
            status: EvidenceAttachmentStatus.PENDING_REVIEW,
          },
          select: {
            targetType: true,
            targetId: true,
          },
          take: 1000,
        }),
        this.prisma.behaviorRestriction.findMany({
          where: {
            status: BehaviorRestrictionStatus.ACTIVE,
          },
          select: {
            userId: true,
          },
          take: 1000,
        }),
      ]);

    const pendingEvidenceTargetKeys = new Set(
      pendingEvidence.map(
        (item) => `${item.targetType}:${item.targetId}`,
      ),
    );

    const restrictedUserIds = new Set(
      activeRestrictions.map((item) => item.userId),
    );

    return transactions.map((tx) => {
      const latestDispute = tx.disputes[0] ?? null;

      const hasOpenDispute = latestDispute?.status === DisputeStatus.OPEN;

      const hasPendingPayout =
        tx.payout?.status === PayoutStatus.REQUESTED ||
        tx.payout?.status === PayoutStatus.PROCESSING;

      const hasPendingRefund =
        tx.refund?.status === RefundStatus.REQUESTED ||
        tx.refund?.status === RefundStatus.PROCESSING;

      const hasPendingEvidenceReview =
        pendingEvidenceTargetKeys.has(
          `${EvidenceAttachmentObjectType.TRANSACTION}:${tx.id}`,
        ) ||
        pendingEvidenceTargetKeys.has(
          `${EvidenceAttachmentObjectType.DELIVERY}:${tx.id}`,
        ) ||
        Boolean(
          tx.packageId &&
            pendingEvidenceTargetKeys.has(
              `${EvidenceAttachmentObjectType.PACKAGE}:${tx.packageId}`,
            ),
        ) ||
        Boolean(
          latestDispute?.id &&
            pendingEvidenceTargetKeys.has(
              `${EvidenceAttachmentObjectType.DISPUTE}:${latestDispute.id}`,
            ),
        ) ||
        Boolean(
          tx.payout?.id &&
            pendingEvidenceTargetKeys.has(
              `${EvidenceAttachmentObjectType.PAYOUT}:${tx.payout.id}`,
            ),
        ) ||
        Boolean(
          tx.refund?.id &&
            pendingEvidenceTargetKeys.has(
              `${EvidenceAttachmentObjectType.REFUND}:${tx.refund.id}`,
            ),
        );

      const hasActiveRestriction =
        restrictedUserIds.has(tx.senderId) || restrictedUserIds.has(tx.travelerId);

      const reasons = this.buildReasons({
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingPayout,
        hasPendingRefund,
        hasActiveRestriction,
        paymentStatus: tx.paymentStatus,
        hasAmlCase: Boolean(tx.amlCase),
      });

      const operationalSeverity = this.resolveSeverity({
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingPayout,
        hasPendingRefund,
        hasActiveRestriction,
        paymentStatus: tx.paymentStatus,
      });

      const recommendedAction = this.resolveRecommendedAction({
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingPayout,
        hasPendingRefund,
        hasActiveRestriction,
      });

      return {
        transactionId: tx.id,
        transactionStatus: tx.status,
        paymentStatus: tx.paymentStatus,
        amount: tx.amount,
        currency: tx.currency,
        senderId: tx.senderId,
        travelerId: tx.travelerId,
        packageId: tx.packageId ?? null,
        tripId: tx.tripId ?? null,
        corridorId: tx.corridorId ?? null,
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingRefund,
        hasPendingPayout,
        hasActiveRestriction,
        requiresAdminAttention: reasons.length > 0,
        operationalSeverity,
        recommendedAction,
        reasons,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      };
    });
  }

  private buildReasons(input: {
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingPayout: boolean;
    hasPendingRefund: boolean;
    hasActiveRestriction: boolean;
    paymentStatus: PaymentStatus;
    hasAmlCase: boolean;
  }) {
    const reasons: string[] = [];

    if (input.hasOpenDispute) {
      reasons.push('OPEN_DISPUTE');
    }

    if (input.hasPendingEvidenceReview) {
      reasons.push('PENDING_EVIDENCE_REVIEW');
    }

    if (input.hasPendingPayout) {
      reasons.push('PENDING_PAYOUT');
    }

    if (input.hasPendingRefund) {
      reasons.push('PENDING_REFUND');
    }

    if (input.hasActiveRestriction) {
      reasons.push('ACTIVE_USER_RESTRICTION');
    }

    if (input.paymentStatus === PaymentStatus.FAILED) {
      reasons.push('PAYMENT_FAILED');
    }

    if (input.hasAmlCase) {
      reasons.push('AML_CASE_PRESENT');
    }

    return reasons;
  }

  private resolveSeverity(input: {
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingPayout: boolean;
    hasPendingRefund: boolean;
    hasActiveRestriction: boolean;
    paymentStatus: PaymentStatus;
  }): TransactionOperationalSeverity {
    if (
      input.hasOpenDispute ||
      input.hasActiveRestriction ||
      input.paymentStatus === PaymentStatus.FAILED ||
      (input.hasPendingEvidenceReview && input.hasPendingPayout)
    ) {
      return TransactionOperationalSeverity.HIGH;
    }

    if (
      input.hasPendingEvidenceReview ||
      input.hasPendingPayout ||
      input.hasPendingRefund
    ) {
      return TransactionOperationalSeverity.MEDIUM;
    }

    return TransactionOperationalSeverity.LOW;
  }

  private resolveRecommendedAction(input: {
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingPayout: boolean;
    hasPendingRefund: boolean;
    hasActiveRestriction: boolean;
  }): TransactionRecommendedAction {
    if (input.hasOpenDispute && input.hasPendingEvidenceReview) {
      return TransactionRecommendedAction.REVIEW_DISPUTE_AND_EVIDENCE;
    }

    if (input.hasOpenDispute) {
      return TransactionRecommendedAction.REVIEW_DISPUTE;
    }

    if (input.hasPendingEvidenceReview) {
      return TransactionRecommendedAction.REVIEW_EVIDENCE;
    }

    if (input.hasActiveRestriction) {
      return TransactionRecommendedAction.REVIEW_USER_RESTRICTION;
    }

    if (input.hasPendingPayout) {
      return TransactionRecommendedAction.MONITOR_PAYOUT;
    }

    if (input.hasPendingRefund) {
      return TransactionRecommendedAction.MONITOR_REFUND;
    }

    return TransactionRecommendedAction.NO_ACTION_REQUIRED;
  }

  private sortItems(
    items: AdminTransactionOperationItemDto[],
    sortBy = AdminTransactionOperationsSortBy.UPDATED_AT,
    sortOrder = SortOrder.DESC,
  ) {
    const severityRank = {
      [TransactionOperationalSeverity.HIGH]: 3,
      [TransactionOperationalSeverity.MEDIUM]: 2,
      [TransactionOperationalSeverity.LOW]: 1,
    };

    items.sort((a, b) => {
      let compare = 0;

      switch (sortBy) {
        case AdminTransactionOperationsSortBy.CREATED_AT:
          compare = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case AdminTransactionOperationsSortBy.AMOUNT:
          compare = a.amount - b.amount;
          break;
        case AdminTransactionOperationsSortBy.SEVERITY:
          compare =
            severityRank[a.operationalSeverity] -
            severityRank[b.operationalSeverity];
          break;
        case AdminTransactionOperationsSortBy.UPDATED_AT:
        default:
          compare = a.updatedAt.getTime() - b.updatedAt.getTime();
      }

      return sortOrder === SortOrder.ASC ? compare : -compare;
    });
  }
}