import { Injectable } from '@nestjs/common';
import { PaymentStatus, PayoutStatus, RefundStatus, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminFinancialControlResponseDto } from './dto/admin-financial-control-response.dto';
import { AdminFinancialControlsSummaryResponseDto } from './dto/admin-financial-controls-summary-response.dto';
import {
  AdminFinancialControlStatus,
  ListAdminFinancialControlsQueryDto,
} from './dto/list-admin-financial-controls-query.dto';

type FinancialControlRow = AdminFinancialControlResponseDto;

@Injectable()
export class AdminFinancialControlsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<AdminFinancialControlsSummaryResponseDto> {
    const rows = await this.listControlsInternal({ limit: 500 });

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

  async listControls(query: ListAdminFinancialControlsQueryDto) {
    return this.listControlsInternal(query);
  }

  private async listControlsInternal(
    query: Partial<ListAdminFinancialControlsQueryDto>,
  ) {
    const limit = query.limit ?? 20;

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

    rows.sort((a, b) => {
      const aTime = (a.updatedAt ?? a.createdAt).getTime();
      const bTime = (b.updatedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

    return rows.slice(0, limit);
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