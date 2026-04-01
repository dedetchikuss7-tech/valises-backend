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

export type LedgerBalances = {
  escrowBalance: number;
  commissionBalance: number;
  reserveBalance: number;
  releasableAmount: number;
};

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async listByTransaction(transactionId: string): Promise<LedgerEntry[]> {
    if (!transactionId) {
      throw new BadRequestException('transactionId is required');
    }

    return this.prisma.ledgerEntry.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getBalances(
    transactionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<LedgerBalances> {
    if (!transactionId) {
      throw new BadRequestException('transactionId is required');
    }

    const db = tx ?? this.prisma;

    const entries = await db.ledgerEntry.findMany({
      where: { transactionId },
      select: { type: true, amount: true },
    });

    return this.computeBalances(entries);
  }

  async getEscrowBalance(
    transactionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const balances = await this.getBalances(transactionId, tx);
    return balances.escrowBalance;
  }

  async getCommissionBalance(
    transactionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const balances = await this.getBalances(transactionId, tx);
    return balances.commissionBalance;
  }

  async getReserveBalance(
    transactionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const balances = await this.getBalances(transactionId, tx);
    return balances.reserveBalance;
  }

  async getReleasableAmount(
    transactionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const balances = await this.getBalances(transactionId, tx);
    return balances.releasableAmount;
  }

  async addEntryIdempotent(
    input: CreateLedgerEntryInput,
    tx?: Prisma.TransactionClient,
  ): Promise<LedgerEntry> {
    const normalized = this.normalizeAndValidateInput(input, {
      requireIdempotencyKey: true,
    });

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

    if (existing) {
      return existing;
    }

    const entries = await dbTx.ledgerEntry.findMany({
      where: { transactionId: normalized.transactionId },
      select: { type: true, amount: true },
    });

    const balances = this.computeBalances(entries);

    if (this.isEscrowDebit(normalized.type)) {
      if (normalized.amount > balances.escrowBalance) {
        throw new BadRequestException(
          `Insufficient escrow balance. Tried to debit ${normalized.amount} but balance is ${balances.escrowBalance}.`,
        );
      }
    }

    if (this.isCommissionDebit(normalized.type)) {
      if (normalized.amount > balances.commissionBalance) {
        throw new BadRequestException(
          `Insufficient commission balance. Tried to debit ${normalized.amount} but balance is ${balances.commissionBalance}.`,
        );
      }
    }

    if (this.isReserveDebit(normalized.type)) {
      if (normalized.amount > balances.reserveBalance) {
        throw new BadRequestException(
          `Insufficient reserve balance. Tried to debit ${normalized.amount} but balance is ${balances.reserveBalance}.`,
        );
      }
    }

    return dbTx.ledgerEntry.create({
      data: {
        transactionId: normalized.transactionId,
        type: normalized.type,
        amount: normalized.amount,
        currency: normalized.currency ?? 'XAF',
        note: normalized.note ?? null,
        idempotencyKey: normalized.idempotencyKey ?? null,
        source: normalized.source ?? LedgerSource.SYSTEM,
        referenceType:
          normalized.referenceType ?? LedgerReferenceType.TRANSACTION,
        referenceId: normalized.referenceId ?? null,
        actorUserId: normalized.actorUserId ?? null,
      },
    });
  }

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
      throw new BadRequestException(
        'idempotencyKey is required for idempotent writes',
      );
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
    return (
      type === LedgerEntryType.ESCROW_DEBIT_RELEASE ||
      type === LedgerEntryType.ESCROW_DEBIT_REFUND
    );
  }

  private isEscrowCredit(type: LedgerEntryType): boolean {
    return type === LedgerEntryType.ESCROW_CREDIT;
  }

  private isCommissionCredit(type: LedgerEntryType): boolean {
    return type === LedgerEntryType.COMMISSION_ACCRUAL;
  }

  private isCommissionDebit(type: LedgerEntryType): boolean {
    return type === LedgerEntryType.COMMISSION_REVERSAL;
  }

  private isReserveCredit(type: LedgerEntryType): boolean {
    return type === LedgerEntryType.RESERVE_CREDIT;
  }

  private isReserveDebit(type: LedgerEntryType): boolean {
    return type === LedgerEntryType.RESERVE_DEBIT;
  }

  private computeBalances(
    entries: Array<Pick<LedgerEntry, 'type' | 'amount'>>,
  ): LedgerBalances {
    let escrowCredit = 0;
    let escrowDebit = 0;
    let commissionCredit = 0;
    let commissionDebit = 0;
    let reserveCredit = 0;
    let reserveDebit = 0;

    for (const entry of entries) {
      if (this.isEscrowCredit(entry.type)) {
        escrowCredit += entry.amount;
        continue;
      }

      if (this.isEscrowDebit(entry.type)) {
        escrowDebit += entry.amount;
        continue;
      }

      if (this.isCommissionCredit(entry.type)) {
        commissionCredit += entry.amount;
        continue;
      }

      if (this.isCommissionDebit(entry.type)) {
        commissionDebit += entry.amount;
        continue;
      }

      if (this.isReserveCredit(entry.type)) {
        reserveCredit += entry.amount;
        continue;
      }

      if (this.isReserveDebit(entry.type)) {
        reserveDebit += entry.amount;
      }
    }

    const escrowBalance = escrowCredit - escrowDebit;
    const commissionBalance = commissionCredit - commissionDebit;
    const reserveBalance = reserveCredit - reserveDebit;
    const releasableAmount = Math.max(
      0,
      escrowBalance - commissionBalance - reserveBalance,
    );

    return {
      escrowBalance,
      commissionBalance,
      reserveBalance,
      releasableAmount,
    };
  }
}