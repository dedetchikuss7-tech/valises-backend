import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, PayoutStatus, RefundStatus, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { BulkActionResultDto } from '../common/dto/bulk-action-result.dto';
import { AdminFinancialControlResponseDto } from './dto/admin-financial-control-response.dto';
import { AdminFinancialControlsSummaryResponseDto } from './dto/admin-financial-controls-summary-response.dto';
import { BulkAdminFinancialControlReviewDto } from './dto/bulk-admin-financial-control-review.dto';
import {
  AdminFinancialControlsSortBy,
  AdminFinancialControlStatus,
  ListAdminFinancialControlsQueryDto,
  SortOrder,
} from './dto/list-admin-financial-controls-query.dto';

type FinancialControlRow = AdminFinancialControlResponseDto;

@Injectable()
export class AdminFinancialControlsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<AdminFinancialControlsSummaryResponseDto> {
    const page = await this.listControlsInternal({ limit: 500, offset: 0 });
    const rows = page.items;

    const cleanRows = rows.filter(
      (row) => row.derivedStatus === AdminFinancialControlStatus.CLEAN,
    ).length;
    const warningRows = rows.filter(
      (row) => row.derivedStatus === AdminFinancialControlStatus.WARNING,
    ).length;
    const breachRows = rows.filter(
      (row) => row.derivedStatus === AdminFinancialControlStatus.BREACH,
    ).length;
    const requiresActionCount = rows.filter((row) => row.requiresAction).length;

    return {
      generatedAt: new Date(),
      totalRows: rows.length,
      cleanRows,
      warningRows,
      breachRows,
      requiresActionCount,
    };
  }

  async listControls(
    query: ListAdminFinancialControlsQueryDto,
  ): Promise<PaginatedListResponseDto<FinancialControlRow>> {
    return this.listControlsInternal(query);
  }

  async bulkAcknowledgeControls(
    actorAdminId: string,
    dto: BulkAdminFinancialControlReviewDto,
  ): Promise<BulkActionResultDto> {
    const results: BulkActionResultDto['results'] = [];

    for (const item of dto.items) {
      try {
        const existing = await this.findControlRow(item.transactionId);

        if (!existing) {
          throw new NotFoundException('Financial control row not found');
        }

        await this.prisma.adminActionAudit.create({
          data: {
            action: 'FINANCIAL_CONTROL_ACK',
            targetType: 'TRANSACTION',
            targetId: item.transactionId,
            actorUserId: actorAdminId,
            metadata: {
              derivedStatus: existing.derivedStatus,
              mismatchSignals: existing.mismatchSignals,
              note: dto.note ?? null,
            },
          },
        });

        results.push({
          itemId: item.transactionId,
          success: true,
          message: null,
        });
      } catch (error: any) {
        results.push({
          itemId: item.transactionId,
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

  private async findControlRow(
    transactionId: string,
  ): Promise<FinancialControlRow | null> {
    const page = await this.listControlsInternal({
      transactionId,
      limit: 1,
      offset: 0,
    });

    return page.items[0] ?? null;
  }

  private async listControlsInternal(
    query: Partial<ListAdminFinancialControlsQueryDto>,
  ): Promise<PaginatedListResponseDto<FinancialControlRow>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: any = {};
    if (query.transactionId) {
      where.id = query.transactionId;
    }
    if (query.userId) {
      where.OR = [{ senderId: query.userId }, { travelerId: query.userId }];
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentStatus: true,
        senderId: true,
        travelerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let rows = await Promise.all(
      transactions.map((tx) => this.buildFinancialControlRow(tx)),
    );

    if (query.status) {
      rows = rows.filter((row) => row.derivedStatus === query.status);
    }

    if (query.requiresAction !== undefined) {
      rows = rows.filter((row) => row.requiresAction === query.requiresAction);
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();
      rows = rows.filter((row) => {
        const haystack = [
          row.transactionId,
          row.transactionStatus,
          row.paymentStatus,
          row.senderId ?? '',
          row.travelerId ?? '',
          row.currency,
          ...row.mismatchSignals,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    const sortBy = query.sortBy ?? AdminFinancialControlsSortBy.UPDATED_AT;
    const sortOrder = query.sortOrder ?? SortOrder.DESC;

    rows.sort((a, b) => {
      let compare = 0;

      switch (sortBy) {
        case AdminFinancialControlsSortBy.CREATED_AT:
          compare = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case AdminFinancialControlsSortBy.UPDATED_AT:
          compare =
            (a.updatedAt ?? a.createdAt).getTime() -
            (b.updatedAt ?? b.createdAt).getTime();
          break;
        case AdminFinancialControlsSortBy.STATUS:
          compare = a.derivedStatus.localeCompare(b.derivedStatus);
          break;
        case AdminFinancialControlsSortBy.TRANSACTION_AMOUNT:
          compare = a.transactionAmount - b.transactionAmount;
          break;
        case AdminFinancialControlsSortBy.REMAINING_ESCROW:
          compare = a.remainingEscrowAmount - b.remainingEscrowAmount;
          break;
        default:
          compare =
            (a.updatedAt ?? a.createdAt).getTime() -
            (b.updatedAt ?? b.createdAt).getTime();
      }

      return sortOrder === SortOrder.ASC ? compare : -compare;
    });

    const total = rows.length;
    const pagedItems = rows.slice(offset, offset + limit);

    return {
      items: pagedItems,
      total,
      limit,
      offset,
      hasMore: offset + pagedItems.length < total,
    };
  }

  private async buildFinancialControlRow(tx: {
    id: string;
    amount: any;
    currency: string;
    status: TransactionStatus;
    paymentStatus: PaymentStatus;
    senderId: string | null;
    travelerId: string | null;
    createdAt: Date;
    updatedAt: Date | null;
  }): Promise<FinancialControlRow> {
    const [ledgerEntries, payouts, refunds] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: {
          referenceId: tx.id,
        },
        orderBy: [{ createdAt: 'asc' }],
        select: {
          id: true,
          type: true,
          amount: true,
          currency: true,
          createdAt: true,
          source: true,
          referenceType: true,
          referenceId: true,
        },
      }),
      this.prisma.payout.findMany({
        where: {
          transactionId: tx.id,
        },
        orderBy: [{ createdAt: 'asc' }],
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          provider: true,
          railProvider: true,
          payoutMethodType: true,
          failureReason: true,
        },
      }),
      this.prisma.refund.findMany({
        where: {
          transactionId: tx.id,
        },
        orderBy: [{ createdAt: 'asc' }],
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          provider: true,
          failureReason: true,
        },
      }),
    ]);

    const transactionAmount = Number(tx.amount);

    const ledgerCreditedAmount = ledgerEntries
      .filter((entry) => String(entry.type) === 'ESCROW_CREDIT')
      .reduce((sum, entry) => sum + Number(entry.amount), 0);

    const ledgerReleasedAmount = ledgerEntries
      .filter((entry) => String(entry.type) === 'ESCROW_DEBIT_RELEASE')
      .reduce((sum, entry) => sum + Number(entry.amount), 0);

    const ledgerRefundedAmount = ledgerEntries
      .filter((entry) => String(entry.type) === 'ESCROW_DEBIT_REFUND')
      .reduce((sum, entry) => sum + Number(entry.amount), 0);

    const payoutPaidAmount = payouts
      .filter((row) => row.status === PayoutStatus.PAID)
      .reduce((sum, row) => sum + Number(row.amount), 0);

    const refundPaidAmount = refunds
      .filter((row) => row.status === RefundStatus.REFUNDED)
      .reduce((sum, row) => sum + Number(row.amount), 0);

    const remainingEscrowAmount =
      ledgerCreditedAmount - ledgerReleasedAmount - ledgerRefundedAmount;

    const mismatchSignals: string[] = [];

    if (
      tx.paymentStatus === PaymentStatus.SUCCESS &&
      ledgerCreditedAmount === 0
    ) {
      mismatchSignals.push('MISSING_LEDGER_COVERAGE');
    }

    if (
      tx.paymentStatus === PaymentStatus.SUCCESS &&
      ledgerCreditedAmount !== 0 &&
      ledgerCreditedAmount !== transactionAmount
    ) {
      mismatchSignals.push('LEDGER_AMOUNT_MISMATCH');
    }

    if (payoutPaidAmount > ledgerCreditedAmount) {
      mismatchSignals.push('OVER_PAYOUT');
    }

    if (refundPaidAmount > ledgerCreditedAmount) {
      mismatchSignals.push('OVER_REFUND');
    }

    if (payoutPaidAmount + refundPaidAmount > ledgerCreditedAmount) {
      mismatchSignals.push('OVER_SETTLEMENT');
    }

    if (
      tx.status === TransactionStatus.DELIVERED &&
      remainingEscrowAmount !== 0
    ) {
      mismatchSignals.push('ESCROW_IMBALANCE_AFTER_DELIVERY');
    }

    const derivedStatus = this.resolveDerivedStatus(mismatchSignals);
    const requiresAction = derivedStatus !== AdminFinancialControlStatus.CLEAN;

    return {
      transactionId: tx.id,
      derivedStatus,
      requiresAction,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      senderId: tx.senderId,
      travelerId: tx.travelerId,
      transactionStatus: tx.status,
      paymentStatus: tx.paymentStatus,
      transactionAmount,
      currency: tx.currency,
      ledgerCreditedAmount,
      ledgerReleasedAmount,
      ledgerRefundedAmount,
      payoutPaidAmount,
      refundPaidAmount,
      remainingEscrowAmount,
      mismatchSignals,
      metadata: {
        ledgerEntryCount: ledgerEntries.length,
        payoutCount: payouts.length,
        refundCount: refunds.length,
      },
    };
  }

  private resolveDerivedStatus(
    mismatchSignals: string[],
  ): AdminFinancialControlStatus {
    if (
      mismatchSignals.includes('OVER_PAYOUT') ||
      mismatchSignals.includes('OVER_REFUND') ||
      mismatchSignals.includes('OVER_SETTLEMENT')
    ) {
      return AdminFinancialControlStatus.BREACH;
    }

    if (
      mismatchSignals.includes('MISSING_LEDGER_COVERAGE') ||
      mismatchSignals.includes('LEDGER_AMOUNT_MISMATCH') ||
      mismatchSignals.includes('ESCROW_IMBALANCE_AFTER_DELIVERY')
    ) {
      return AdminFinancialControlStatus.WARNING;
    }

    return AdminFinancialControlStatus.CLEAN;
  }
}