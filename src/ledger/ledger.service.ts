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
};

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ✅ Backward-compatible: used by TransactionService
   */
  async listByTransaction(transactionId: string): Promise<LedgerEntry[]> {
    if (!transactionId) throw new BadRequestException('transactionId is required');

    return this.prisma.ledgerEntry.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Escrow balance = sum(ESCROW_CREDIT) - sum(escrow debits)
   * Debits include:
   * - ESCROW_DEBIT_RELEASE
   * - ESCROW_DEBIT_REFUND
   * - legacy ESCROW_DEBIT (kept for backward compatibility / existing rows)
   */
  async getEscrowBalance(transactionId: string): Promise<number> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { transactionId },
      select: { type: true, amount: true },
    });

    return this.computeEscrowBalance(entries);
  }

  /**
   * Strict idempotent add:
   * - requires idempotencyKey (non-empty)
   * - validates amount > 0
   * - prevents legacy type usage for new writes
   * - for escrow debits: checks escrow balance >= amount (within SAME DB transaction)
   */
  async addEntryIdempotent(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    const normalized = this.normalizeAndValidateInput(input, { requireIdempotencyKey: true });

    // Atomic transaction: (1) check existing by compound unique, (2) check balance if debit, (3) insert
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

      // Escrow invariant: you cannot debit more than current escrow balance
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

  /**
   * Non-idempotent add (optional utility).
   * Keeps compatibility: may be used in future for non-idempotent writes.
   */
  async addEntry(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    const normalized = this.normalizeAndValidateInput(input, { requireIdempotencyKey: false });

    // Still enforce escrow invariant for debits (atomic with insert)
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

    // amount
    if (input.amount == null || Number.isNaN(input.amount)) {
      throw new BadRequestException('amount is required');
    }
    if (!Number.isInteger(input.amount)) {
      throw new BadRequestException('amount must be an integer (cents/units)');
    }
    if (input.amount <= 0) {
      throw new BadRequestException('amount must be > 0');
    }

    // type
    if (!input.type) {
      throw new BadRequestException('type is required');
    }

    // Block legacy type for new writes (still supported in reads)
    if (input.type === LedgerEntryType.ESCROW_DEBIT) {
      throw new BadRequestException(
        `LedgerEntryType.ESCROW_DEBIT is legacy and must not be used for new writes. Use ESCROW_DEBIT_RELEASE or ESCROW_DEBIT_REFUND.`,
      );
    }

    // idempotencyKey
    const idk = (input.idempotencyKey ?? '').trim();
    if (opts.requireIdempotencyKey) {
      if (!idk) throw new BadRequestException('idempotencyKey is required for idempotent writes');
    }

    // currency (optional)
    const currency = (input.currency ?? 'EUR').trim() || 'EUR';

    return {
      transactionId: input.transactionId,
      type: input.type,
      amount: input.amount,
      currency,
      note: input.note ?? null,
      idempotencyKey: idk || null,
    };
  }

  private isEscrowDebit(type: LedgerEntryType): boolean {
    return (
      type === LedgerEntryType.ESCROW_DEBIT_RELEASE ||
      type === LedgerEntryType.ESCROW_DEBIT_REFUND ||
      // legacy treated as debit for balance computation safety
      type === LedgerEntryType.ESCROW_DEBIT
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