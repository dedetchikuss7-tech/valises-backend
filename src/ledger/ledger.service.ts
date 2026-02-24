import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerEntryType, Prisma } from '@prisma/client';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent write:
   * - if (transactionId, idempotencyKey) already exists => return existing entry
   */
  async addEntryIdempotent(params: {
    transactionId: string;
    type: LedgerEntryType;
    amount: number;
    currency?: string;
    note?: string;
    idempotencyKey: string;
  }) {
    const { transactionId, type, amount, currency = 'EUR', note, idempotencyKey } = params;

    try {
      return await this.prisma.ledgerEntry.create({
        data: { transactionId, type, amount, currency, note, idempotencyKey },
      });
    } catch (e: any) {
      // P2002 = unique constraint failed
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.ledgerEntry.findFirst({
          where: { transactionId, idempotencyKey },
        });
        if (existing) return existing;
      }
      throw e;
    }
  }

  async listByTransaction(transactionId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Escrow balance = credits - debits (only escrow entries).
   */
  async getEscrowBalance(transactionId: string): Promise<number> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        transactionId,
        type: { in: [LedgerEntryType.ESCROW_CREDIT, LedgerEntryType.ESCROW_DEBIT] },
      },
      orderBy: { createdAt: 'asc' },
    });

    let balance = 0;
    for (const e of entries) {
      if (e.type === LedgerEntryType.ESCROW_CREDIT) balance += e.amount;
      if (e.type === LedgerEntryType.ESCROW_DEBIT) balance -= e.amount;
    }
    return balance;
  }
}