import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LedgerEntry,
  LedgerEntryType,
  LedgerReferenceType,
  LedgerSource,
  Prisma,
} from '@prisma/client';

type CreateLedgerEntryInput = {
  transactionId: string;
  type: LedgerEntryType;
  amount: number;
  currency?: string;
  note?: string | null;
  idempotencyKey?: string | null;

  source?: LedgerSource;
  referenceType?: LedgerReferenceType;
  referenceId?: string | null;
  actorUserId?: string | null;
};

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read-only list
   */
  async listByTransaction(transactionId: string): Promise<LedgerEntry[]> {
    if (!transactionId) throw new BadRequestException('transactionId is required');

    return this.prisma.ledgerEntry.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Computes escrow balance from ledger table.
   */
  async getEscrowBalance(transactionId: string, tx?: Prisma.TransactionClient): Promise<number> {
    if (!transactionId) throw new BadRequestException('transactionId is required');
    const db = tx ?? this.prisma;

    const entries = await db.ledgerEntry.findMany({
      where: { transactionId },
      select: { type: true, amount: true },
    });

    return this.computeEscrowBalance(entries);
  }

  /**
   * Idempotent ledger write.
   * If a Prisma TransactionClient is provided, this write happens inside it.
   */
  async addEntryIdempotent(input: CreateLedgerEntryInput, tx?: Prisma.TransactionClient): Promise<LedgerEntry> {
    const normalized = this.normalizeAndValidateInput(input, { requireIdempotencyKey: true });

    // If caller already provides a tx, we must NOT open a nested $transaction.
    if (tx) {
      return this.addEntryIdempotentInsideTx(normalized, tx);
    }

    return this.prisma.$transaction(async (dbTx) => {
      return this.addEntryIdempotentInsideTx(normalized, dbTx);
    });
  }

  private async addEntryIdempotentInsideTx(
    normalized: CreateLedgerEntryInput,
    dbTx: Prisma.TransactionClient,
  ): Promise<LedgerEntry> {
    const existing = await dbTx.ledgerEntry.findUnique({
      where: {
        transactionId_idempotencyKey: {
          transactionId: normalized.transactionId,
          idempotencyKey: normalized.idempotencyKey!,
        },
      },
    });
    if (existing) return existing;

    // Prevent overdraft for escrow debits
    if (this.isEscrowDebit(normalized.type)) {
      const entries = await dbTx.ledgerEntry.findMany({
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

    return dbTx.ledgerEntry.create({
      data: {
        transactionId: normalized.transactionId,
        type: normalized.type,
        amount: normalized.amount,

        // IMPORTANT: par défaut XAF (tu utilises XAF partout dans tes flows)
        currency: normalized.currency ?? 'XAF',

        note: normalized.note ?? null,
        idempotencyKey: normalized.idempotencyKey ?? null,

        source: normalized.source ?? LedgerSource.SYSTEM,
        referenceType: normalized.referenceType ?? LedgerReferenceType.TRANSACTION,
        referenceId: normalized.referenceId ?? null,
        actorUserId: normalized.actorUserId ?? null,
      },
    });
  }

  private normalizeAndValidateInput(
    input: CreateLedgerEntryInput,
    opts: { requireIdempotencyKey: boolean },
  ): CreateLedgerEntryInput {
    if (!input?.transactionId) throw new BadRequestException('transactionId is required');

    if (input.amount == null || Number.isNaN(input.amount)) throw new BadRequestException('amount is required');
    if (!Number.isInteger(input.amount)) throw new BadRequestException('amount must be an integer (cents/units)');
    if (input.amount <= 0) throw new BadRequestException('amount must be > 0');

    if (!input.type) throw new BadRequestException('type is required');

    const idk = (input.idempotencyKey ?? '').trim();
    if (opts.requireIdempotencyKey && !idk) {
      throw new BadRequestException('idempotencyKey is required for idempotent writes');
    }

    const currency = (input.currency ?? 'XAF').trim() || 'XAF';

    return {
      transactionId: input.transactionId,
      type: input.type,
      amount: input.amount,
      currency,
      note: input.note ?? null,
      idempotencyKey: idk || null,

      source: input.source ?? LedgerSource.SYSTEM,
      referenceType: input.referenceType ?? LedgerReferenceType.TRANSACTION,
      referenceId: (input.referenceId ?? null) || null,
      actorUserId: (input.actorUserId ?? null) || null,
    };
  }

  private isEscrowDebit(type: LedgerEntryType): boolean {
    return type === LedgerEntryType.ESCROW_DEBIT_RELEASE || type === LedgerEntryType.ESCROW_DEBIT_REFUND;
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