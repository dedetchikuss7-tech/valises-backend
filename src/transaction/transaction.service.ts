import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  KycStatus,
  LedgerEntryType,
  LedgerReferenceType,
  LedgerSource,
  PaymentStatus,
  Transaction,
  TransactionStatus,
} from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  private static readonly MAX_PER_TX_VERIFIED_XAF = 2_000_000;

  async create(senderId: string, travelerId: string, amount: number): Promise<Transaction> {
    if (!senderId || !travelerId) {
      throw new BadRequestException('senderId and travelerId are required');
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive integer');
    }

    // ✅ V1 per-transaction limit (defense early)
    if (amount > TransactionService.MAX_PER_TX_VERIFIED_XAF) {
      throw new BadRequestException({
        code: 'LIMIT_EXCEEDED',
        message: `Amount exceeds per-transaction limit (${TransactionService.MAX_PER_TX_VERIFIED_XAF} XAF).`,
        amount,
        maxAllowed: TransactionService.MAX_PER_TX_VERIFIED_XAF,
      });
    }

    const [sender, traveler] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: senderId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: travelerId }, select: { id: true } }),
    ]);

    if (!sender) throw new NotFoundException(`Sender ${senderId} not found`);
    if (!traveler) throw new NotFoundException(`Traveler ${travelerId} not found`);

    return this.prisma.transaction.create({
      data: {
        senderId,
        travelerId,
        amount,
        commission: 0,
        escrowAmount: 0,
        status: TransactionStatus.CREATED,
        paymentStatus: PaymentStatus.PENDING,
      },
    });
  }

  async findAll() {
    return this.prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    return this.prisma.transaction.findUniqueOrThrow({ where: { id } });
  }

  async updateStatus(id: string, status: TransactionStatus) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);

    return this.prisma.transaction.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * PATCH /transactions/:id/payment/:status
   * - SUCCESS => requires traveler KYC VERIFIED, then writes ESCROW_CREDIT idempotently
   */
  async markPayment(id: string, paymentStatus: PaymentStatus) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);

    // If already SUCCESS and asked again, remain idempotent.
    // (Ledger is also idempotent via idempotencyKey.)
    if (tx.paymentStatus === PaymentStatus.SUCCESS && paymentStatus === PaymentStatus.SUCCESS) {
      return tx;
    }

    // ✅ KYC gating (V1): traveler must be VERIFIED before payment can be confirmed
    if (paymentStatus === PaymentStatus.SUCCESS) {
      const traveler = await this.prisma.user.findUnique({
        where: { id: tx.travelerId },
        select: { id: true, kycStatus: true },
      });

      if (!traveler) throw new NotFoundException(`Traveler ${tx.travelerId} not found`);

      if (traveler.kycStatus !== KycStatus.VERIFIED) {
        throw new BadRequestException({
          code: 'KYC_REQUIRED',
          message: 'Traveler KYC must be VERIFIED before payment can be confirmed.',
          nextStep: 'KYC',
          nextStepUrl: '/kyc',
          travelerId: traveler.id,
          kycStatus: traveler.kycStatus,
        });
      }

      // ✅ V1 per-transaction limit (defense in depth at payment time too)
      if (tx.amount > TransactionService.MAX_PER_TX_VERIFIED_XAF) {
        throw new BadRequestException({
          code: 'LIMIT_EXCEEDED',
          message: `Amount exceeds per-transaction limit (${TransactionService.MAX_PER_TX_VERIFIED_XAF} XAF).`,
          amount: tx.amount,
          maxAllowed: TransactionService.MAX_PER_TX_VERIFIED_XAF,
        });
      }
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        paymentStatus,
        status: paymentStatus === PaymentStatus.SUCCESS ? TransactionStatus.PAID : tx.status,
        escrowAmount: paymentStatus === PaymentStatus.SUCCESS ? tx.amount : tx.escrowAmount,
      },
    });

    if (paymentStatus === PaymentStatus.SUCCESS) {
      await this.ledger.addEntryIdempotent({
        transactionId: id,
        type: LedgerEntryType.ESCROW_CREDIT,
        amount: tx.amount,
        currency: 'XAF',
        note: 'Payment confirmed: escrow credited',
        idempotencyKey: `payment_success:${id}`,
        source: LedgerSource.PAYMENT,
        referenceType: LedgerReferenceType.PAYMENT,
        referenceId: `payment_success:${id}`,
        actorUserId: null,
      });
    }

    return updated;
  }

  /**
   * PATCH /transactions/:id/release
   * - releases ALL remaining escrow to traveler (non-dispute flow)
   */
  async releaseFunds(id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Cannot release: paymentStatus is not SUCCESS');
    }
    if (tx.status !== TransactionStatus.DELIVERED) {
      throw new BadRequestException('Cannot release: transaction must be DELIVERED');
    }

    const balance = await this.ledger.getEscrowBalance(id);
    if (balance <= 0) {
      return {
        ok: true,
        transactionId: id,
        releasedAmount: 0,
        escrowBalance: balance,
      };
    }

    const releaseKey = `release:${id}`;

    await this.ledger.addEntryIdempotent({
      transactionId: id,
      type: LedgerEntryType.ESCROW_DEBIT_RELEASE,
      amount: balance,
      currency: 'XAF',
      note: 'Release escrow to traveler (delivery confirmed)',
      idempotencyKey: releaseKey,
      source: LedgerSource.RELEASE,
      referenceType: LedgerReferenceType.TRANSACTION,
      referenceId: id,
      actorUserId: null,
    });

    return {
      ok: true,
      transactionId: id,
      releasedAmount: balance,
      escrowBalance: await this.ledger.getEscrowBalance(id),
    };
  }

  /**
   * GET /transactions/:id/ledger
   * - reads REAL ledger table
   */
  async getLedger(id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id }, select: { id: true } });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);

    const entries = await this.ledger.listByTransaction(id);

    return {
      transactionId: id,
      entries: entries.map((e) => ({
        type: e.type,
        amount: e.amount,
        currency: e.currency,
        createdAt: e.createdAt,
        note: e.note ?? null,
        idempotencyKey: e.idempotencyKey ?? null,
        source: (e as any).source ?? null,
        referenceType: (e as any).referenceType ?? null,
        referenceId: (e as any).referenceId ?? null,
        actorUserId: (e as any).actorUserId ?? null,
      })),
    };
  }
}