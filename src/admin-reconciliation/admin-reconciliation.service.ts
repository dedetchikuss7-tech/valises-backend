import { Injectable } from '@nestjs/common';
import { PaymentStatus, PayoutStatus, RefundStatus, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { AdminReconciliationCaseResponseDto } from './dto/admin-reconciliation-case-response.dto';
import { AdminReconciliationSummaryResponseDto } from './dto/admin-reconciliation-summary-response.dto';
import {
  AdminReconciliationCaseType,
  AdminReconciliationDerivedStatus,
  ListAdminReconciliationCasesQueryDto,
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

  private async listCasesInternal(
    query: Partial<ListAdminReconciliationCasesQueryDto>,
  ): Promise<PaginatedListResponseDto<NormalizedReconciliationRow>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [payoutRows, refundRows] = await Promise.all([
      this.loadPayoutRows(query),
      this.loadRefundRows(query),
    ]);

    let items = [...payoutRows, ...refundRows];

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
          ...item.mismatchSignals,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    items.sort((a, b) => {
      const aTime = (a.updatedAt ?? a.createdAt).getTime();
      const bTime = (b.updatedAt ?? b.createdAt).getTime();
      return bTime - aTime;
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