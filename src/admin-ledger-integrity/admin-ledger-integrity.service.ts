import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';

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
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const computedEscrowBalance = await this.ledgerService.getEscrowBalance(
      transactionId,
    );

    const storedEscrowAmount = transaction.escrowAmount;
    const delta = storedEscrowAmount - computedEscrowBalance;

    return {
      transactionId: transaction.id,
      status: transaction.status,
      paymentStatus: transaction.paymentStatus,
      amount: transaction.amount,
      commission: transaction.commission,
      senderId: transaction.senderId,
      travelerId: transaction.travelerId,
      storedEscrowAmount,
      computedEscrowBalance,
      delta,
      integrityStatus: delta === 0 ? 'OK' : 'MISMATCH',
      ledgerEntryCount: transaction.ledgerEntries.length,
      ledgerEntries: transaction.ledgerEntries,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  async listMismatches(limit = 50) {
    const transactions = await this.prisma.transaction.findMany({
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        amount: true,
        commission: true,
        escrowAmount: true,
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
      },
    });

    const results = transactions.map((tx) => {
      let credit = 0;
      let debit = 0;

      for (const entry of tx.ledgerEntries) {
        if (entry.type === 'ESCROW_CREDIT') {
          credit += entry.amount;
        } else if (
          entry.type === 'ESCROW_DEBIT_RELEASE' ||
          entry.type === 'ESCROW_DEBIT_REFUND'
        ) {
          debit += entry.amount;
        }
      }

      const computedEscrowBalance = credit - debit;
      const storedEscrowAmount = tx.escrowAmount;
      const delta = storedEscrowAmount - computedEscrowBalance;

      return {
        transactionId: tx.id,
        status: tx.status,
        paymentStatus: tx.paymentStatus,
        amount: tx.amount,
        commission: tx.commission,
        senderId: tx.senderId,
        travelerId: tx.travelerId,
        storedEscrowAmount,
        computedEscrowBalance,
        delta,
        integrityStatus: delta === 0 ? 'OK' : 'MISMATCH',
        ledgerEntryCount: tx.ledgerEntries.length,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      };
    });

    const mismatches = results.filter((row) => row.delta !== 0);

    return {
      inspectedCount: results.length,
      mismatchCount: mismatches.length,
      items: mismatches,
    };
  }
}