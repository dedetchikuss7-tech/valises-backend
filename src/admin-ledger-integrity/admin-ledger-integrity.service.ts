import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LedgerEntryType,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  LedgerIntegritySortBy,
  LedgerIntegrityStatus,
  ListLedgerMismatchesQueryDto,
  SortOrder,
} from './dto/list-ledger-mismatches-query.dto';

type LedgerEntryLite = {
  id?: string;
  type: LedgerEntryType | string;
  amount: number;
  currency?: string | null;
  source?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  createdAt?: Date;
};

type TransactionIntegrityInput = {
  id: string;
  status: string;
  paymentStatus: string;
  amount: number;
  commission: number;
  escrowAmount: number;
  currency?: string | null;
  senderId: string | null;
  travelerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  ledgerEntries: LedgerEntryLite[];
  payout?: {
    id: string;
    status: PayoutStatus | string;
    amount: number;
    currency: string;
    paidAt?: Date | null;
  } | null;
  refund?: {
    id: string;
    status: RefundStatus | string;
    amount: number;
    currency: string;
    refundedAt?: Date | null;
  } | null;
};

type IntegrityRow = {
  transactionId: string;
  status: string;
  paymentStatus: string;
  amount: number;
  commission: number;
  currency: string | null;
  senderId: string | null;
  travelerId: string | null;
  storedEscrowAmount: number;
  computedEscrowBalance: number;
  delta: number;
  deltaAbs: number;
  escrowCreditedAmount: number;
  escrowReleasedAmount: number;
  escrowRefundedAmount: number;
  commissionAccruedAmount: number;
  commissionReversedAmount: number;
  reserveCreditedAmount: number;
  reserveDebitedAmount: number;
  payoutPaidAmount: number;
  refundPaidAmount: number;
  integrityStatus: LedgerIntegrityStatus;
  requiresAction: boolean;
  recommendedAction: string;
  mismatchSignals: string[];
  warningSignals: string[];
  breachSignals: string[];
  ledgerEntryCount: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AdminLedgerIntegrityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async getTransactionIntegrity(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        amount: true,
        commission: true,
        escrowAmount: true,
        currency: true,
        senderId: true,
        travelerId: true,
        createdAt: true,
        updatedAt: true,
        ledgerEntries: {
          select: {
            id: true,
            type: true,
            amount: true,
            currency: true,
            source: true,
            referenceType: true,
            referenceId: true,
            idempotencyKey: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        payout: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            paidAt: true,
          },
        },
        refund: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            refundedAt: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const computedEscrowBalance = await this.ledgerService.getEscrowBalance(
      transactionId,
    );

    const row = this.buildIntegrityRow(transaction, computedEscrowBalance);

    return {
      ...row,
      ledgerEntries: transaction.ledgerEntries,
      payout: transaction.payout ?? null,
      refund: transaction.refund ?? null,
    };
  }

  async listMismatches(query: ListLedgerMismatchesQueryDto = {}) {
    const inspectLimit = query.inspectLimit ?? 200;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const transactions = await this.prisma.transaction.findMany({
      take: inspectLimit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        amount: true,
        commission: true,
        escrowAmount: true,
        currency: true,
        senderId: true,
        travelerId: true,
        createdAt: true,
        updatedAt: true,
        ledgerEntries: {
          select: {
            type: true,
            amount: true,
          },
        },
        payout: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            paidAt: true,
          },
        },
        refund: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            refundedAt: true,
          },
        },
      },
    });

    const rows = transactions.map((transaction) =>
      this.buildIntegrityRow(transaction),
    );

    const filtered = this.sortRows(
      rows.filter((row) => this.matchesQuery(row, query)),
      query.sortBy ?? LedgerIntegritySortBy.UPDATED_AT,
      query.sortOrder ?? SortOrder.DESC,
    );

    const items = filtered.slice(offset, offset + limit);

    return {
      inspectedCount: rows.length,
      mismatchCount: rows.filter(
        (row) => row.integrityStatus !== LedgerIntegrityStatus.OK,
      ).length,
      breachCount: rows.filter(
        (row) => row.integrityStatus === LedgerIntegrityStatus.BREACH,
      ).length,
      warningCount: rows.filter(
        (row) => row.integrityStatus === LedgerIntegrityStatus.WARNING,
      ).length,
      requiresActionCount: rows.filter((row) => row.requiresAction).length,
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + limit < filtered.length,
      items,
    };
  }

  private buildIntegrityRow(
    tx: TransactionIntegrityInput,
    computedEscrowBalanceOverride?: number,
  ): IntegrityRow {
    const sums = this.sumLedgerEntries(tx.ledgerEntries);
    const computedEscrowBalance =
      computedEscrowBalanceOverride ??
      sums.escrowCreditedAmount -
        sums.escrowReleasedAmount -
        sums.escrowRefundedAmount;

    const storedEscrowAmount = tx.escrowAmount;
    const delta = storedEscrowAmount - computedEscrowBalance;
    const payoutPaidAmount =
      tx.payout?.status === PayoutStatus.PAID ? tx.payout.amount : 0;
    const refundPaidAmount =
      tx.refund?.status === RefundStatus.REFUNDED ? tx.refund.amount : 0;

    const breachSignals: string[] = [];
    const warningSignals: string[] = [];

    if (delta !== 0) {
      breachSignals.push('ESCROW_BALANCE_MISMATCH');
    }

    if (computedEscrowBalance < 0) {
      breachSignals.push('NEGATIVE_COMPUTED_ESCROW');
    }

    if (storedEscrowAmount < 0) {
      breachSignals.push('NEGATIVE_STORED_ESCROW');
    }

    if (
      sums.escrowReleasedAmount + sums.escrowRefundedAmount >
      sums.escrowCreditedAmount
    ) {
      breachSignals.push('LEDGER_DEBITS_EXCEED_ESCROW_CREDITS');
    }

    if (
      tx.paymentStatus === PaymentStatus.SUCCESS &&
      sums.escrowCreditedAmount <= 0
    ) {
      breachSignals.push('PAYMENT_SUCCESS_WITHOUT_ESCROW_CREDIT');
    }

    if (
      tx.payout?.status === PayoutStatus.PAID &&
      sums.escrowReleasedAmount < payoutPaidAmount
    ) {
      breachSignals.push('PAID_PAYOUT_WITHOUT_MATCHING_RELEASE_LEDGER');
    }

    if (
      tx.refund?.status === RefundStatus.REFUNDED &&
      sums.escrowRefundedAmount < refundPaidAmount
    ) {
      breachSignals.push('REFUNDED_REFUND_WITHOUT_MATCHING_REFUND_LEDGER');
    }

    if (
      tx.paymentStatus === PaymentStatus.REFUNDED &&
      storedEscrowAmount !== 0
    ) {
      warningSignals.push('PAYMENT_REFUNDED_WITH_NON_ZERO_ESCROW');
    }

    if (
      sums.escrowCreditedAmount > 0 &&
      computedEscrowBalance === 0 &&
      storedEscrowAmount > 0
    ) {
      warningSignals.push('LEDGER_FULLY_SETTLED_BUT_STORED_ESCROW_REMAINS');
    }

    if (
      sums.commissionReversedAmount > sums.commissionAccruedAmount &&
      sums.commissionReversedAmount > 0
    ) {
      warningSignals.push('COMMISSION_REVERSAL_EXCEEDS_ACCRUAL');
    }

    if (
      sums.reserveDebitedAmount > sums.reserveCreditedAmount &&
      sums.reserveDebitedAmount > 0
    ) {
      warningSignals.push('RESERVE_DEBIT_EXCEEDS_CREDIT');
    }

    const integrityStatus =
      breachSignals.length > 0
        ? LedgerIntegrityStatus.BREACH
        : warningSignals.length > 0
          ? LedgerIntegrityStatus.WARNING
          : LedgerIntegrityStatus.OK;

    const mismatchSignals = [...breachSignals, ...warningSignals];
    const requiresAction = integrityStatus !== LedgerIntegrityStatus.OK;

    return {
      transactionId: tx.id,
      status: tx.status,
      paymentStatus: tx.paymentStatus,
      amount: tx.amount,
      commission: tx.commission,
      currency: tx.currency ?? null,
      senderId: tx.senderId,
      travelerId: tx.travelerId,
      storedEscrowAmount,
      computedEscrowBalance,
      delta,
      deltaAbs: Math.abs(delta),
      escrowCreditedAmount: sums.escrowCreditedAmount,
      escrowReleasedAmount: sums.escrowReleasedAmount,
      escrowRefundedAmount: sums.escrowRefundedAmount,
      commissionAccruedAmount: sums.commissionAccruedAmount,
      commissionReversedAmount: sums.commissionReversedAmount,
      reserveCreditedAmount: sums.reserveCreditedAmount,
      reserveDebitedAmount: sums.reserveDebitedAmount,
      payoutPaidAmount,
      refundPaidAmount,
      integrityStatus,
      requiresAction,
      recommendedAction: this.recommendAction(integrityStatus, mismatchSignals),
      mismatchSignals,
      warningSignals,
      breachSignals,
      ledgerEntryCount: tx.ledgerEntries.length,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  }

  private sumLedgerEntries(entries: LedgerEntryLite[]) {
    let escrowCreditedAmount = 0;
    let escrowReleasedAmount = 0;
    let escrowRefundedAmount = 0;
    let commissionAccruedAmount = 0;
    let commissionReversedAmount = 0;
    let reserveCreditedAmount = 0;
    let reserveDebitedAmount = 0;

    for (const entry of entries) {
      if (entry.type === LedgerEntryType.ESCROW_CREDIT) {
        escrowCreditedAmount += entry.amount;
      }

      if (entry.type === LedgerEntryType.ESCROW_DEBIT_RELEASE) {
        escrowReleasedAmount += entry.amount;
      }

      if (entry.type === LedgerEntryType.ESCROW_DEBIT_REFUND) {
        escrowRefundedAmount += entry.amount;
      }

      if (entry.type === LedgerEntryType.COMMISSION_ACCRUAL) {
        commissionAccruedAmount += entry.amount;
      }

      if (entry.type === LedgerEntryType.COMMISSION_REVERSAL) {
        commissionReversedAmount += entry.amount;
      }

      if (entry.type === LedgerEntryType.RESERVE_CREDIT) {
        reserveCreditedAmount += entry.amount;
      }

      if (entry.type === LedgerEntryType.RESERVE_DEBIT) {
        reserveDebitedAmount += entry.amount;
      }
    }

    return {
      escrowCreditedAmount,
      escrowReleasedAmount,
      escrowRefundedAmount,
      commissionAccruedAmount,
      commissionReversedAmount,
      reserveCreditedAmount,
      reserveDebitedAmount,
    };
  }

  private recommendAction(
    status: LedgerIntegrityStatus,
    signals: string[],
  ): string {
    if (status === LedgerIntegrityStatus.OK) {
      return 'NO_ACTION_REQUIRED';
    }

    if (
      signals.includes('PAID_PAYOUT_WITHOUT_MATCHING_RELEASE_LEDGER') ||
      signals.includes('REFUNDED_REFUND_WITHOUT_MATCHING_REFUND_LEDGER')
    ) {
      return 'REVIEW_PAYOUT_REFUND_LEDGER_LINK';
    }

    if (
      signals.includes('PAYMENT_SUCCESS_WITHOUT_ESCROW_CREDIT') ||
      signals.includes('ESCROW_BALANCE_MISMATCH')
    ) {
      return 'RECONCILE_TRANSACTION_LEDGER';
    }

    if (signals.includes('LEDGER_DEBITS_EXCEED_ESCROW_CREDITS')) {
      return 'FREEZE_AND_INVESTIGATE_LEDGER';
    }

    return 'REVIEW_LEDGER_SIGNALS';
  }

  private matchesQuery(
    row: IntegrityRow,
    query: ListLedgerMismatchesQueryDto,
  ): boolean {
    if (!query.includeOk && row.integrityStatus === LedgerIntegrityStatus.OK) {
      return false;
    }

    if (query.status && row.integrityStatus !== query.status) {
      return false;
    }

    if (
      query.requiresAction !== undefined &&
      row.requiresAction !== query.requiresAction
    ) {
      return false;
    }

    if (!query.q) {
      return true;
    }

    const needle = query.q.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    const haystack = [
      row.transactionId,
      row.status,
      row.paymentStatus,
      row.currency,
      row.senderId,
      row.travelerId,
      row.integrityStatus,
      row.recommendedAction,
      ...row.mismatchSignals,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(needle);
  }

  private sortRows(
    rows: IntegrityRow[],
    sortBy: LedgerIntegritySortBy,
    sortOrder: SortOrder,
  ): IntegrityRow[] {
    const direction = sortOrder === SortOrder.ASC ? 1 : -1;

    return [...rows].sort((a, b) => {
      const left = this.sortValue(a, sortBy);
      const right = this.sortValue(b, sortBy);

      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }

  private sortValue(row: IntegrityRow, sortBy: LedgerIntegritySortBy) {
    if (sortBy === LedgerIntegritySortBy.CREATED_AT) {
      return row.createdAt.getTime();
    }

    if (sortBy === LedgerIntegritySortBy.DELTA_ABS) {
      return row.deltaAbs;
    }

    if (sortBy === LedgerIntegritySortBy.SIGNAL_COUNT) {
      return row.mismatchSignals.length;
    }

    if (sortBy === LedgerIntegritySortBy.TRANSACTION_AMOUNT) {
      return row.amount;
    }

    if (sortBy === LedgerIntegritySortBy.STORED_ESCROW) {
      return row.storedEscrowAmount;
    }

    if (sortBy === LedgerIntegritySortBy.COMPUTED_ESCROW) {
      return row.computedEscrowBalance;
    }

    return row.updatedAt.getTime();
  }
}