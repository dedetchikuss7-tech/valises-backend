import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerEntryType } from '@prisma/client';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async addEntry(params: {
    transactionId: string;
    type: LedgerEntryType;
    amount: number;
    currency?: string;
    note?: string;
  }) {
    const { transactionId, type, amount, currency = 'EUR', note } = params;

    return this.prisma.ledgerEntry.create({
      data: { transactionId, type, amount, currency, note },
    });
  }

  async listByTransaction(transactionId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
    });
  }
}