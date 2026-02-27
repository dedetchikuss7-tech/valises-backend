import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerEntry, LedgerEntryType } from '@prisma/client';

type CreateLedgerEntryInput = {
  transactionId: string;
  type: LedgerEntryType;
  amount: number;
  currency?: string;
  note?: string | null;
  idempotencyKey?: string | null;

  // audit fields are accepted at API level, but NOT persisted yet (Prisma schema doesn't include them)
  source?: any;
  referenceType?: any;
  referenceId?: string | null;
  actorUserId?: string | null;
};

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async listByTransaction(transactionId: string): Promise<LedgerEntry[]> {
    if (!transactionId) throw new BadRequestException('transactionId is required');

    return this.prisma.ledgerEntry.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getEscrowBalance(transactionId: string): Promise<number> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { transactionId },
      select: { type: true, amount: true },
    });

    return this.computeEscrowBalance(entries);
  }

  async addEntryIdempotent(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    const normalized = this.normalizeAndValidateInput(input, { requireIdempotencyKey: true });

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerEntry.findUnique({
        where: {
          transactionId_idempotencyKey: {
            transactionId: normalized.transactionId,
            idempotencyKey: normalized.idempotencyKey!,
          },
        },
      });

      if (existing) return existing;

      if (this.isEscrowDebit(normalized.type)) {
        const entries = await tx.ledgerEntry.findMany({
          where: { transactionId: normalized.transactionId },
          select: { type: true, amount: true },
        });

        const escrowBalance = this.computeEscrowBalance(entries);
        if (normalized.amount > escrowBalance) {
          throw new BadRequestException(
            `Insufficient escrow balance. Tried to debit ${normalized.amount} but balance is ${escrowBalance}.`,
          );
        }
      }

      return tx.ledgerEntry.create({
        data: {
          transactionId: normalized.transactionId,
          type: normalized.type,
          amount: normalized.amount,
          currency: normalized.currency ?? 'EUR',
          note: normalized.note ?? null,
          idempotencyKey: normalized.idempotencyKey ?? null,
        },
      });
    });
  }

  async addEntry(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    const normalized = this.normalizeAndValidateInput(input, { requireIdempotencyKey: false });

    return this.prisma.$transaction(async (tx) => {
      if (this.isEscrowDebit(normalized.type)) {
        const entries = await tx.ledgerEntry.findMany({
          where: { transactionId: normalized.transactionId },
          select: { type: true, amount: true },
        });

        const escrowBalance = this.computeEscrowBalance(entries);
        if (normalized.amount > escrowBalance) {
          throw new BadRequestException(
            `Insufficient escrow balance. Tried to debit ${normalized.amount} but balance is ${escrowBalance}.`,
          );
        }
      }

      return tx.ledgerEntry.create({
        data: {
          transactionId: normalized.transactionId,
          type: normalized.type,
          amount: normalized.amount,
          currency: normalized.currency ?? 'EUR',
          note: normalized.note ?? null,
          idempotencyKey: normalized.idempotencyKey ?? null,
        },
      });
    });
  }

  // -------------------------
  // Helpers
  // -------------------------

  private normalizeAndValidateInput(
    input: CreateLedgerEntryInput,
    opts: { requireIdempotencyKey: boolean },
  ): CreateLedgerEntryInput {
    if (!input?.transactionId) {
      throw new BadRequestException('transactionId is required');
    }

    if (input.amount == null || Number.isNaN(input.amount)) {
      throw new BadRequestException('amount is required');
    }
    if (!Number.isInteger(input.amount)) {
      throw new BadRequestException('amount must be an integer (cents/units)');
    }
    if (input.amount <= 0) {
      throw new BadRequestException('amount must be > 0');
    }

    if (!input.type) {
      throw new BadRequestException('type is required');
    }

    const idk = (input.idempotencyKey ?? '').trim();
    if (opts.requireIdempotencyKey && !idk) {
      throw new BadRequestException('idempotencyKey is required for idempotent writes');
    }

    const currency = (input.currency ?? 'EUR').trim() || 'EUR';

    return {
      transactionId: input.transactionId,
      type: input.type,
      amount: input.amount,
      currency,
      note: input.note ?? null,
      idempotencyKey: idk || null,

      // accepted but ignored for persistence until schema supports it
      source: input.source,
      referenceType: input.referenceType,
      referenceId: (input.referenceId ?? null) || null,
      actorUserId: (input.actorUserId ?? null) || null,
    };
  }

  private isEscrowDebit(type: LedgerEntryType): boolean {
    return (
      type === LedgerEntryType.ESCROW_DEBIT_RELEASE ||
      type === LedgerEntryType.ESCROW_DEBIT_REFUND
    );
  }

  private isEscrowCredit(type: LedgerEntryType): boolean {
    return type === LedgerEntryType.ESCROW_CREDIT;
  }

  private computeEscrowBalance(entries: Array<Pick<LedgerEntry, 'type' | 'amount'>>): number {
    let credit = 0;
    let debit = 0;

    for (const e of entries) {
      if (this.isEscrowCredit(e.type)) credit += e.amount;
      else if (this.isEscrowDebit(e.type)) debit += e.amount;
    }

    return credit - debit;
  }
}