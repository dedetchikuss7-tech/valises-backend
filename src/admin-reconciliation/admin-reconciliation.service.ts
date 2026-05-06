import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { BulkActionResultDto } from '../common/dto/bulk-action-result.dto';
import { AdminReconciliationCaseResponseDto } from './dto/admin-reconciliation-case-response.dto';
import { AdminReconciliationSummaryResponseDto } from './dto/admin-reconciliation-summary-response.dto';
import { BulkAdminReconciliationReviewDto } from './dto/bulk-admin-reconciliation-review.dto';
import {
  AdminReconciliationCaseType,
  AdminReconciliationDerivedStatus,
  AdminReconciliationRecommendedAction,
  AdminReconciliationSortBy,
  AdminReconciliationUrgencyLevel,
  ListAdminReconciliationCasesQueryDto,
  SortOrder,
} from './dto/list-admin-reconciliation-cases-query.dto';

type NormalizedReconciliationRow = AdminReconciliationCaseResponseDto;

@Injectable()
export class AdminReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<AdminReconciliationSummaryResponseDto> {
    const page = await this.listCasesInternal({
      limit: 500,
      offset: 0,
    });
    const rows = page.items;

    return {
      generatedAt: new Date(),
      totalPayoutRows: rows.filter(
        (row) => row.caseType === AdminReconciliationCaseType.PAYOUT,
      ).length,
      totalRefundRows: rows.filter(
        (row) => row.caseType === AdminReconciliationCaseType.REFUND,
      ).length,
      pendingRows: rows.filter(
        (row) => row.derivedStatus === AdminReconciliationDerivedStatus.PENDING,
      ).length,
      failedRows: rows.filter(
        (row) => row.derivedStatus === AdminReconciliationDerivedStatus.FAILED,
      ).length,
      mismatchRows: rows.filter(
        (row) => row.derivedStatus === AdminReconciliationDerivedStatus.MISMATCH,
      ).length,
      cleanRows: rows.filter(
        (row) => row.derivedStatus === AdminReconciliationDerivedStatus.CLEAN,
      ).length,
      highUrgencyRows: rows.filter(
        (row) => row.urgencyLevel === AdminReconciliationUrgencyLevel.HIGH,
      ).length,
      mediumUrgencyRows: rows.filter(
        (row) => row.urgencyLevel === AdminReconciliationUrgencyLevel.MEDIUM,
      ).length,
      lowUrgencyRows: rows.filter(
        (row) => row.urgencyLevel === AdminReconciliationUrgencyLevel.LOW,
      ).length,
      reviewedRows: rows.filter((row) => row.isReviewed).length,
      unreviewedRows: rows.filter((row) => !row.isReviewed).length,
      requiresActionCount: rows.filter((row) => row.requiresAction).length,
    };
  }

  async listCases(
    query: ListAdminReconciliationCasesQueryDto,
  ): Promise<PaginatedListResponseDto<NormalizedReconciliationRow>> {
    return this.listCasesInternal(query);
  }

  async bulkMarkReviewed(
    actorAdminId: string,
    dto: BulkAdminReconciliationReviewDto,
  ): Promise<BulkActionResultDto> {
    const results: BulkActionResultDto['results'] = [];

    for (const item of dto.items) {
      try {
        const existing = await this.findCaseRow(item.caseType, item.caseId);

        if (!existing) {
          throw new NotFoundException('Reconciliation row not found');
        }

        await this.prisma.adminActionAudit.create({
          data: {
            action: 'RECONCILIATION_REVIEW',
            targetType: item.caseType,
            targetId: item.caseId,
            actorUserId: actorAdminId,
            metadata: {
              transactionId: existing.transactionId,
              derivedStatus: existing.derivedStatus,
              urgencyLevel: existing.urgencyLevel,
              recommendedAction: existing.recommendedAction,
              mismatchSignals: existing.mismatchSignals,
              note: dto.note ?? null,
            },
          },
        });

        results.push({
          itemId: `${item.caseType}:${item.caseId}`,
          success: true,
          message: null,
        });
      } catch (error: any) {
        results.push({
          itemId: `${item.caseType}:${item.caseId}`,
          success: false,
          message: error?.message ?? 'Unknown error',
        });
      }
    }

    const successCount = results.filter((item) => item.success).length;
    const failureCount = results.length - successCount;

    return {
      requestedCount: dto.items.length,
      successCount,
      failureCount,
      results,
    };
  }

  private async findCaseRow(
    caseType: AdminReconciliationCaseType,
    caseId: string,
  ): Promise<NormalizedReconciliationRow | null> {
    const page = await this.listCasesInternal({
      caseType,
      limit: 500,
      offset: 0,
    });

    return page.items.find((item) => item.caseId === caseId) ?? null;
  }

  private async listCasesInternal(
    query: Partial<ListAdminReconciliationCasesQueryDto>,
  ): Promise<PaginatedListResponseDto<NormalizedReconciliationRow>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [payoutRows, refundRows, adminAudits] = await Promise.all([
      this.loadPayoutRows(query),
      this.loadRefundRows(query),
      this.loadRelevantAudits(),
    ]);

    let items = [...payoutRows, ...refundRows].map((row) =>
      this.attachAuditSummary(row, adminAudits),
    );

    items = items.map((item) => this.enrichOperationalSignals(item));

    if (query.status) {
      items = items.filter((item) => item.derivedStatus === query.status);
    }

    if (query.urgencyLevel) {
      items = items.filter((item) => item.urgencyLevel === query.urgencyLevel);
    }

    if (query.recommendedAction) {
      items = items.filter(
        (item) => item.recommendedAction === query.recommendedAction,
      );
    }

    if (query.requiresAction !== undefined) {
      items = items.filter(
        (item) => item.requiresAction === query.requiresAction,
      );
    }

    if (query.isReviewed !== undefined) {
      items = items.filter((item) => item.isReviewed === query.isReviewed);
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();
      items = items.filter((item) => {
        const haystack = [
          item.caseType,
          item.caseId,
          item.derivedStatus,
          item.urgencyLevel,
          item.recommendedAction,
          item.provider,
          item.rawStatus,
          item.transactionId ?? '',
          item.senderId ?? '',
          item.travelerId ?? '',
          item.currency,
          item.lastAdminActionType ?? '',
          item.lastAdminActionBy ?? '',
          ...item.mismatchSignals,
          ...item.urgencyReasons,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    items = this.sortRows(
      items,
      query.sortBy ?? AdminReconciliationSortBy.UPDATED_AT,
      query.sortOrder ?? SortOrder.DESC,
    );

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

  private async loadRelevantAudits() {
    return this.prisma.adminActionAudit.findMany({
      where: {
        action: {
          in: ['RECONCILIATION_REVIEW'],
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  private attachAuditSummary(
    row: NormalizedReconciliationRow,
    audits: Array<{
      targetType: string;
      targetId: string;
      actorUserId: string | null;
      action: string;
      createdAt: Date;
    }>,
  ): NormalizedReconciliationRow {
    const relevant = audits
      .filter(
        (audit) =>
          audit.targetType === row.caseType && audit.targetId === row.caseId,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const last = relevant[relevant.length - 1] ?? null;

    return {
      ...row,
      lastAdminActionAt: last?.createdAt ?? null,
      lastAdminActionBy: last?.actorUserId ?? null,
      lastAdminActionType: last?.action ?? null,
      adminActionCount: relevant.length,
      isReviewed: relevant.length > 0,
    };
  }

  private enrichOperationalSignals(
    row: NormalizedReconciliationRow,
  ): NormalizedReconciliationRow {
    const ageMinutes = this.computeAgeMinutes(row.updatedAt ?? row.createdAt);
    const urgencyReasons: string[] = [];

    if (row.derivedStatus === AdminReconciliationDerivedStatus.MISMATCH) {
      urgencyReasons.push('RECONCILIATION_MISMATCH');
    }

    if (row.derivedStatus === AdminReconciliationDerivedStatus.FAILED) {
      urgencyReasons.push('PROVIDER_FAILURE');
    }

    if (row.derivedStatus === AdminReconciliationDerivedStatus.PENDING) {
      urgencyReasons.push('PROVIDER_STATUS_PENDING');
    }

    if (ageMinutes >= 24 * 60 && row.requiresAction) {
      urgencyReasons.push('OLDER_THAN_24H');
    }

    if (ageMinutes >= 60 && row.requiresAction) {
      urgencyReasons.push('OLDER_THAN_1H');
    }

    if (row.isReviewed && row.requiresAction) {
      urgencyReasons.push('ALREADY_REVIEWED_STILL_REQUIRES_ACTION');
    }

    const urgencyLevel = this.resolveUrgencyLevel(
      row.derivedStatus,
      ageMinutes,
      row.isReviewed,
    );

    const recommendedAction = this.resolveRecommendedAction(
      row.derivedStatus,
      row.isReviewed,
    );

    return {
      ...row,
      ageMinutes,
      urgencyReasons,
      urgencyLevel,
      recommendedAction,
    };
  }

  private async loadPayoutRows(
    query: Partial<ListAdminReconciliationCasesQueryDto>,
  ): Promise<NormalizedReconciliationRow[]> {
    if (
      query.caseType &&
      query.caseType !== AdminReconciliationCaseType.PAYOUT
    ) {
      return [];
    }

    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (query.userId) {
      where.transaction = {
        OR: [{ senderId: query.userId }, { travelerId: query.userId }],
      };
    }

    const rows = await this.prisma.payout.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      include: {
        transaction: {
          select: {
            id: true,
            senderId: true,
            travelerId: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    });

    return rows.map((row) => {
      const mismatchSignals: string[] = [];

      if (!row.transactionId) {
        mismatchSignals.push('MISSING_TRANSACTION_LINK');
      }

      if (row.transaction?.paymentStatus !== PaymentStatus.SUCCESS) {
        mismatchSignals.push('PAYMENT_NOT_CONFIRMED');
      }

      if (
        row.status === PayoutStatus.PAID &&
        row.transaction?.status !== TransactionStatus.DELIVERED
      ) {
        mismatchSignals.push('PAYOUT_COMPLETED_BEFORE_DELIVERY_CONFIRMED');
      }

      if (
        row.status === PayoutStatus.READY ||
        row.status === PayoutStatus.REQUESTED ||
        row.status === PayoutStatus.PROCESSING
      ) {
        mismatchSignals.push('PAYOUT_STILL_PENDING');
      }

      if (row.status === PayoutStatus.FAILED) {
        mismatchSignals.push('PAYOUT_FAILED');
      }

      const derivedStatus = this.resolvePayoutDerivedStatus(
        row.status,
        mismatchSignals,
      );

      return this.buildBaseRow({
        caseType: AdminReconciliationCaseType.PAYOUT,
        caseId: row.id,
        derivedStatus,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        transactionId: row.transactionId,
        senderId: row.transaction?.senderId ?? null,
        travelerId: row.transaction?.travelerId ?? null,
        provider: row.provider,
        rawStatus: row.status,
        amount: row.amount,
        currency: row.currency,
        mismatchSignals,
        metadata: {
          railProvider: row.railProvider ?? null,
          payoutMethodType: row.payoutMethodType ?? null,
          failureReason: row.failureReason ?? null,
        },
      });
    });
  }

  private async loadRefundRows(
    query: Partial<ListAdminReconciliationCasesQueryDto>,
  ): Promise<NormalizedReconciliationRow[]> {
    if (
      query.caseType &&
      query.caseType !== AdminReconciliationCaseType.REFUND
    ) {
      return [];
    }

    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (query.userId) {
      where.transaction = {
        OR: [{ senderId: query.userId }, { travelerId: query.userId }],
      };
    }

    const rows = await this.prisma.refund.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      include: {
        transaction: {
          select: {
            id: true,
            senderId: true,
            travelerId: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    });

    return rows.map((row) => {
      const mismatchSignals: string[] = [];

      if (!row.transactionId) {
        mismatchSignals.push('MISSING_TRANSACTION_LINK');
      }

      if (row.transaction?.paymentStatus === PaymentStatus.PENDING) {
        mismatchSignals.push('REFUND_WITHOUT_CONFIRMED_PAYMENT');
      }

      if (
        row.status === RefundStatus.REFUNDED &&
        row.transaction?.status === TransactionStatus.DELIVERED
      ) {
        mismatchSignals.push('REFUND_COMPLETED_ON_DELIVERED_TRANSACTION');
      }

      if (
        row.status === RefundStatus.READY ||
        row.status === RefundStatus.REQUESTED ||
        row.status === RefundStatus.PROCESSING
      ) {
        mismatchSignals.push('REFUND_STILL_PENDING');
      }

      if (row.status === RefundStatus.FAILED) {
        mismatchSignals.push('REFUND_FAILED');
      }

      const derivedStatus = this.resolveRefundDerivedStatus(
        row.status,
        mismatchSignals,
      );

      return this.buildBaseRow({
        caseType: AdminReconciliationCaseType.REFUND,
        caseId: row.id,
        derivedStatus,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        transactionId: row.transactionId,
        senderId: row.transaction?.senderId ?? null,
        travelerId: row.transaction?.travelerId ?? null,
        provider: row.provider,
        rawStatus: row.status,
        amount: row.amount,
        currency: row.currency,
        mismatchSignals,
        metadata: {
          failureReason: row.failureReason ?? null,
        },
      });
    });
  }

  private buildBaseRow(input: {
    caseType: AdminReconciliationCaseType;
    caseId: string;
    derivedStatus: AdminReconciliationDerivedStatus;
    createdAt: Date;
    updatedAt: Date | null;
    transactionId: string | null;
    senderId: string | null;
    travelerId: string | null;
    provider: string;
    rawStatus: string;
    amount: number;
    currency: string;
    mismatchSignals: string[];
    metadata: Record<string, unknown> | null;
  }): NormalizedReconciliationRow {
    return {
      ...input,
      requiresAction:
        input.derivedStatus !== AdminReconciliationDerivedStatus.CLEAN,
      urgencyLevel: AdminReconciliationUrgencyLevel.LOW,
      urgencyReasons: [],
      recommendedAction:
        AdminReconciliationRecommendedAction.NO_ACTION_REQUIRED,
      ageMinutes: this.computeAgeMinutes(input.updatedAt ?? input.createdAt),
      isReviewed: false,
      lastAdminActionAt: null,
      lastAdminActionBy: null,
      lastAdminActionType: null,
      adminActionCount: 0,
    };
  }

  private resolvePayoutDerivedStatus(
    rawStatus: PayoutStatus,
    mismatchSignals: string[],
  ): AdminReconciliationDerivedStatus {
    if (
      mismatchSignals.includes('PAYOUT_COMPLETED_BEFORE_DELIVERY_CONFIRMED') ||
      mismatchSignals.includes('MISSING_TRANSACTION_LINK') ||
      mismatchSignals.includes('PAYMENT_NOT_CONFIRMED')
    ) {
      return AdminReconciliationDerivedStatus.MISMATCH;
    }

    if (rawStatus === PayoutStatus.FAILED) {
      return AdminReconciliationDerivedStatus.FAILED;
    }

    if (
      rawStatus === PayoutStatus.READY ||
      rawStatus === PayoutStatus.REQUESTED ||
      rawStatus === PayoutStatus.PROCESSING
    ) {
      return AdminReconciliationDerivedStatus.PENDING;
    }

    return AdminReconciliationDerivedStatus.CLEAN;
  }

  private resolveRefundDerivedStatus(
    rawStatus: RefundStatus,
    mismatchSignals: string[],
  ): AdminReconciliationDerivedStatus {
    if (
      mismatchSignals.includes('REFUND_COMPLETED_ON_DELIVERED_TRANSACTION') ||
      mismatchSignals.includes('MISSING_TRANSACTION_LINK') ||
      mismatchSignals.includes('REFUND_WITHOUT_CONFIRMED_PAYMENT')
    ) {
      return AdminReconciliationDerivedStatus.MISMATCH;
    }

    if (rawStatus === RefundStatus.FAILED) {
      return AdminReconciliationDerivedStatus.FAILED;
    }

    if (
      rawStatus === RefundStatus.READY ||
      rawStatus === RefundStatus.REQUESTED ||
      rawStatus === RefundStatus.PROCESSING
    ) {
      return AdminReconciliationDerivedStatus.PENDING;
    }

    return AdminReconciliationDerivedStatus.CLEAN;
  }

  private resolveUrgencyLevel(
    status: AdminReconciliationDerivedStatus,
    ageMinutes: number,
    isReviewed: boolean,
  ): AdminReconciliationUrgencyLevel {
    if (status === AdminReconciliationDerivedStatus.CLEAN) {
      return AdminReconciliationUrgencyLevel.LOW;
    }

    if (status === AdminReconciliationDerivedStatus.MISMATCH) {
      return AdminReconciliationUrgencyLevel.HIGH;
    }

    if (status === AdminReconciliationDerivedStatus.FAILED && !isReviewed) {
      return AdminReconciliationUrgencyLevel.HIGH;
    }

    if (ageMinutes >= 24 * 60) {
      return AdminReconciliationUrgencyLevel.HIGH;
    }

    if (status === AdminReconciliationDerivedStatus.FAILED) {
      return AdminReconciliationUrgencyLevel.MEDIUM;
    }

    if (ageMinutes >= 60) {
      return AdminReconciliationUrgencyLevel.MEDIUM;
    }

    return AdminReconciliationUrgencyLevel.LOW;
  }

  private resolveRecommendedAction(
    status: AdminReconciliationDerivedStatus,
    isReviewed: boolean,
  ): AdminReconciliationRecommendedAction {
    if (status === AdminReconciliationDerivedStatus.CLEAN) {
      return AdminReconciliationRecommendedAction.NO_ACTION_REQUIRED;
    }

    if (isReviewed) {
      return AdminReconciliationRecommendedAction.REVIEW_ALREADY_ACKNOWLEDGED_CASE;
    }

    if (status === AdminReconciliationDerivedStatus.MISMATCH) {
      return AdminReconciliationRecommendedAction.INVESTIGATE_RECONCILIATION_MISMATCH;
    }

    if (status === AdminReconciliationDerivedStatus.FAILED) {
      return AdminReconciliationRecommendedAction.RETRY_OR_ESCALATE_PROVIDER_FAILURE;
    }

    return AdminReconciliationRecommendedAction.REVIEW_PENDING_PROVIDER_STATUS;
  }

  private computeAgeMinutes(referenceDate: Date): number {
    return Math.max(
      0,
      Math.floor((Date.now() - referenceDate.getTime()) / 60_000),
    );
  }

  private sortRows(
    rows: NormalizedReconciliationRow[],
    sortBy: AdminReconciliationSortBy,
    sortOrder: SortOrder,
  ): NormalizedReconciliationRow[] {
    const direction = sortOrder === SortOrder.ASC ? 1 : -1;

    return [...rows].sort((a, b) => {
      const left = this.sortValue(a, sortBy);
      const right = this.sortValue(b, sortBy);

      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;

      return (
        (b.updatedAt ?? b.createdAt).getTime() -
        (a.updatedAt ?? a.createdAt).getTime()
      );
    });
  }

  private sortValue(
    row: NormalizedReconciliationRow,
    sortBy: AdminReconciliationSortBy,
  ): string | number {
    if (sortBy === AdminReconciliationSortBy.CREATED_AT) {
      return row.createdAt.getTime();
    }

    if (sortBy === AdminReconciliationSortBy.UPDATED_AT) {
      return (row.updatedAt ?? row.createdAt).getTime();
    }

    if (sortBy === AdminReconciliationSortBy.STATUS) {
      return row.derivedStatus;
    }

    if (sortBy === AdminReconciliationSortBy.CASE_TYPE) {
      return row.caseType;
    }

    if (sortBy === AdminReconciliationSortBy.AMOUNT) {
      return row.amount;
    }

    if (sortBy === AdminReconciliationSortBy.AGE_MINUTES) {
      return row.ageMinutes;
    }

    if (sortBy === AdminReconciliationSortBy.URGENCY) {
      return this.urgencyWeight(row.urgencyLevel);
    }

    return (row.updatedAt ?? row.createdAt).getTime();
  }

  private urgencyWeight(level: AdminReconciliationUrgencyLevel): number {
    if (level === AdminReconciliationUrgencyLevel.HIGH) return 3;
    if (level === AdminReconciliationUrgencyLevel.MEDIUM) return 2;
    return 1;
  }
}