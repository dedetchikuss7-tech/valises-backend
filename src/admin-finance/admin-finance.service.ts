import { Injectable } from '@nestjs/common';
import { PaymentStatus, PayoutStatus, RefundStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BalanceMismatchDto,
  FinanceSummaryDto,
  OrphanTransactionDto,
  PspReconciliationReportDto,
  PspReconciliationRowDto,
} from './dto/finance-summary.dto';

const ORPHAN_THRESHOLD_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class AdminFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinanceSummary(): Promise<FinanceSummaryDto> {
    const [transactions, payouts, refunds] = await Promise.all([
      this.prisma.transaction.findMany({
        select: {
          amount: true,
          escrowAmount: true,
          platformRevenue: true,
          status: true,
          paymentStatus: true,
        },
      }),
      this.prisma.payout.findMany({
        select: { status: true, amount: true },
      }),
      this.prisma.refund.findMany({
        select: { status: true, amount: true },
      }),
    ]);

    const paidTx = transactions.filter(
      (t) => t.paymentStatus === PaymentStatus.SUCCESS,
    );

    const totalEscrow = paidTx.reduce((sum, t) => sum + t.escrowAmount, 0);
    const totalPaid = paidTx.reduce((sum, t) => sum + t.amount, 0);
    const platformRevenue = paidTx.reduce(
      (sum, t) => sum + t.platformRevenue,
      0,
    );

    const totalPendingPayouts = payouts
      .filter(
        (p) =>
          p.status !== PayoutStatus.PAID && p.status !== PayoutStatus.CANCELLED,
      )
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPaidOut = payouts
      .filter((p) => p.status === PayoutStatus.PAID)
      .reduce((sum, p) => sum + p.amount, 0);

    const totalRefunded = refunds
      .filter((r) => r.status === RefundStatus.REFUNDED)
      .reduce((sum, r) => sum + r.amount, 0);

    const byStatus: Record<string, number> = {};
    for (const t of transactions) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    }

    return {
      totalEscrow,
      totalPaid,
      totalPendingPayouts,
      totalPaidOut,
      totalRefunded,
      platformRevenue,
      transactionCount: transactions.length,
      byStatus,
      generatedAt: new Date(),
    };
  }

  async getOrphanTransactions(): Promise<OrphanTransactionDto[]> {
    const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        paymentStatus: PaymentStatus.SUCCESS,
        paymentConfirmedAt: { lte: cutoff },
        payout: null,
      },
      select: {
        id: true,
        senderId: true,
        travelerId: true,
        amount: true,
        escrowAmount: true,
        currency: true,
        paymentStatus: true,
        status: true,
        paymentConfirmedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { paymentConfirmedAt: 'asc' },
    });

    return transactions.map((t) => ({
      ...t,
      ageHours: t.paymentConfirmedAt
        ? Math.floor(
            (Date.now() - t.paymentConfirmedAt.getTime()) / (60 * 60 * 1000),
          )
        : Math.floor((Date.now() - t.createdAt.getTime()) / (60 * 60 * 1000)),
    }));
  }

  async getBalanceMismatches(): Promise<BalanceMismatchDto[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        paymentStatus: PaymentStatus.SUCCESS,
      },
      select: {
        id: true,
        senderId: true,
        amount: true,
        escrowAmount: true,
        currency: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions
      .filter((t) => t.escrowAmount !== t.amount)
      .map((t) => ({
        ...t,
        diff: t.escrowAmount - t.amount,
      }));
  }

  async getPspReconciliationReport(
    dateFrom: string,
    dateTo: string,
  ): Promise<PspReconciliationReportDto> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    // include full last day
    to.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        amount: true,
        escrowAmount: true,
        currency: true,
        paymentConfirmedAt: true,
        createdAt: true,
        payout: {
          select: {
            id: true,
            status: true,
            amount: true,
            paidAt: true,
          },
        },
        refund: {
          select: {
            id: true,
            status: true,
            amount: true,
            refundedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows: PspReconciliationRowDto[] = transactions.map((t) => ({
      transactionId: t.id,
      status: t.status,
      paymentStatus: t.paymentStatus,
      amount: t.amount,
      escrowAmount: t.escrowAmount,
      currency: t.currency,
      paymentConfirmedAt: t.paymentConfirmedAt,
      payoutId: t.payout?.id ?? null,
      payoutStatus: t.payout?.status ?? null,
      payoutAmount: t.payout?.amount ?? null,
      payoutPaidAt: t.payout?.paidAt ?? null,
      refundId: t.refund?.id ?? null,
      refundStatus: t.refund?.status ?? null,
      refundAmount: t.refund?.amount ?? null,
      refundedAt: t.refund?.refundedAt ?? null,
      createdAt: t.createdAt,
    }));

    return {
      dateFrom,
      dateTo,
      rowCount: rows.length,
      rows,
      generatedAt: new Date(),
    };
  }
}
