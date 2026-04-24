import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, PayoutStatus, RefundStatus, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { BulkActionResultDto } from '../common/dto/bulk-action-result.dto';
import { AdminReconciliationCaseResponseDto } from './dto/admin-reconciliation-case-response.dto';
import { AdminReconciliationSummaryResponseDto } from './dto/admin-reconciliation-summary-response.dto';
import { BulkAdminReconciliationReviewDto } from './dto/bulk-admin-reconciliation-review.dto';
import {
  AdminReconciliationCaseType,
  AdminReconciliationDerivedStatus,
  AdminReconciliationSortBy,
  ListAdminReconciliationCasesQueryDto,
  SortOrder,
} from './dto/list-admin-reconciliation-cases-query.dto';

type NormalizedReconciliationRow = AdminReconciliationCaseResponseDto;

@Injectable()
export class AdminReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<AdminReconciliationSummaryResponseDto> {
    const page = await this.listCasesInternal({ limit: 500, offset: 0 });
    const rows = page.items;

    const totalPayoutRows = rows.filter(
      (row) => row.caseType === AdminReconciliationCaseType.PAYOUT,
    ).length;
    const totalRefundRows = rows.filter(
      (row) => row.caseType === AdminReconciliationCaseType.REFUND,
    ).length;
    const pendingRows = rows.filter(
      (row) => row.derivedStatus === AdminReconciliationDerivedStatus.PENDING,
    ).length;
    const failedRows = rows.filter(
      (row) => row.derivedStatus === AdminReconciliationDerivedStatus.FAILED,
    ).length;
    const mismatchRows = rows.filter(
      (row) => row.derivedStatus === AdminReconciliationDerivedStatus.MISMATCH,
    ).length;
    const requiresActionCount = rows.filter((row) => row.requiresAction).length;

    return {
      generatedAt: new Date(),
      totalPayoutRows,
      totalRefundRows,
      pendingRows,
      failedRows,
      mismatchRows,
      requiresActionCount,
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

    if (query.status) {
      items = items.filter((item) => item.derivedStatus === query.status);
    }

    if (query.requiresAction !== undefined) {
      items = items.filter((item) => item.requiresAction === query.requiresAction);
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();
      items = items.filter((item) => {
        const haystack = [
          item.caseType,
          item.caseId,
          item.derivedStatus,
          item.provider,
          item.rawStatus,
          item.transactionId ?? '',
          item.senderId ?? '',
          item.travelerId ?? '',
          item.currency,
          item.lastAdminActionType ?? '',
          item.lastAdminActionBy ?? '',
          ...item.mismatchSignals,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    const sortBy = query.sortBy ?? AdminReconciliationSortBy.UPDATED_AT;
    const sortOrder = query.sortOrder ?? SortOrder.DESC;

    items.sort((a, b) => {
      let compare = 0;

      switch (sortBy) {
        case AdminReconciliationSortBy.CREATED_AT:
          compare = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case AdminReconciliationSortBy.UPDATED_AT:
          compare =
            (a.updatedAt ?? a.createdAt).getTime() -
            (b.updatedAt ?? b.createdAt).getTime();
          break;
        case AdminReconciliationSortBy.STATUS:
          compare = a.derivedStatus.localeCompare(b.derivedStatus);
          break;
        case AdminReconciliationSortBy.CASE_TYPE:
          compare = a.caseType.localeCompare(b.caseType);
          break;
        case AdminReconciliationSortBy.AMOUNT:
          compare = a.amount - b.amount;
          break;
        default:
          compare =
            (a.updatedAt ?? a.createdAt).getTime() -
            (b.updatedAt ?? b.createdAt).getTime();
      }

      return sortOrder === SortOrder.ASC ? compare : -compare;
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
        (audit) => audit.targetType === row.caseType && audit.targetId === row.caseId,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const last = relevant[relevant.length - 1] ?? null;

    return {
      ...row,
      lastAdminActionAt: last?.createdAt ?? null,
      lastAdminActionBy: last?.actorUserId ?? null,
      lastAdminActionType: last?.action ?? null,
      adminActionCount: relevant.length,
    };
  }

  private async loadPayoutRows(
    query: Partial<ListAdminReconciliationCasesQueryDto>,
  ): Promise<NormalizedReconciliationRow[]> {
    if (query.caseType && query.caseType !== AdminReconciliationCaseType.PAYOUT) {
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

      const derivedStatus = this.resolvePayoutDerivedStatus(row.status, mismatchSignals);
      const requiresAction = derivedStatus !== AdminReconciliationDerivedStatus.CLEAN;

      return {
        caseType: AdminReconciliationCaseType.PAYOUT,
        caseId: row.id,
        derivedStatus,
        requiresAction,
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
        lastAdminActionAt: null,
        lastAdminActionBy: null,
        lastAdminActionType: null,
        adminActionCount: 0,
      };
    });
  }

  private async loadRefundRows(
    query: Partial<ListAdminReconciliationCasesQueryDto>,
  ): Promise<NormalizedReconciliationRow[]> {
    if (query.caseType && query.caseType !== AdminReconciliationCaseType.REFUND) {
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

      const derivedStatus = this.resolveRefundDerivedStatus(row.status, mismatchSignals);
      const requiresAction = derivedStatus !== AdminReconciliationDerivedStatus.CLEAN;

      return {
        caseType: AdminReconciliationCaseType.REFUND,
        caseId: row.id,
        derivedStatus,
        requiresAction,
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
        lastAdminActionAt: null,
        lastAdminActionBy: null,
        lastAdminActionType: null,
        adminActionCount: 0,
      };
    });
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
}