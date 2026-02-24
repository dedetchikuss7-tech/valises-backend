import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerEntryType, PaymentStatus, TransactionStatus } from '@prisma/client';
import { TransactionStateMachine } from './transaction-state-machine';
import { LedgerService } from '../ledger/ledger.service';
import { Idempotency } from '../common/idempotency';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async create(senderId: string, travelerId: string, amount: number) {
    if (!senderId || !travelerId) {
      throw new BadRequestException('senderId and travelerId are required');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }

    // V1: escrowAmount = amount; commission = 0 (pricing guardrail postponed)
    return this.prisma.transaction.create({
      data: {
        senderId,
        travelerId,
        amount,
        escrowAmount: amount,
        commission: 0,
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

  async updateStatus(id: string, nextStatus: TransactionStatus) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');

    TransactionStateMachine.assertCanTransition(tx.status, nextStatus);

    return this.prisma.transaction.update({
      where: { id },
      data: { status: nextStatus },
    });
  }

  /**
   * DEV helper: simulate payment status
   * ✅ Idempotent: repeated /payment/success should not duplicate ledger credit.
   */
  async markPayment(id: string, paymentStatus: PaymentStatus) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');

    // Always update payment status (idempotent update is fine)
    await this.prisma.transaction.update({
      where: { id },
      data: { paymentStatus },
    });

    if (paymentStatus === PaymentStatus.SUCCESS) {
      // Transition to PAID if needed
      const current = await this.prisma.transaction.findUniqueOrThrow({ where: { id } });
      if (current.status === TransactionStatus.CREATED) {
        await this.updateStatus(id, TransactionStatus.PAID);
      }

      // ✅ Ledger escrow credit (idempotent)
      await this.ledger.addEntryIdempotent({
        transactionId: id,
        type: LedgerEntryType.ESCROW_CREDIT,
        amount: tx.escrowAmount,
        note: 'Payment confirmed: escrow credited',
        idempotencyKey: Idempotency.tx('payment_success', id),
      });
    }

    return this.prisma.transaction.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Release rule (V1):
   * - status must be DELIVERED
   * - paymentStatus must be SUCCESS
   *
   * ✅ Invariants:
   * - escrowBalance must equal escrowAmount before release (V1 strict)
   *
   * ✅ Idempotent:
   * - repeated /release should not double debit escrow
   *
   * ✅ Uses new ledger debit type:
   * - ESCROW_DEBIT_RELEASE (NOT legacy ESCROW_DEBIT)
   */
  async releaseFunds(id: string) {
    const tx = await this.prisma.transaction.findUniqueOrThrow({ where: { id } });

    if (tx.status !== TransactionStatus.DELIVERED) {
      throw new BadRequestException('Funds can only be released after DELIVERED');
    }
    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Payment must be SUCCESS before releasing funds');
    }

    // V1 strict invariant (before writing): escrowBalance must match expected escrowAmount
    const escrowBalance = await this.ledger.getEscrowBalance(id);
    if (escrowBalance !== tx.escrowAmount) {
      throw new BadRequestException(
        `Escrow balance mismatch: balance=${escrowBalance} expected=${tx.escrowAmount}`,
      );
    }

    const releaseKey = Idempotency.tx('release', id);

    // ✅ This is idempotent: if already exists, ledger service returns the existing entry.
    const entry = await this.ledger.addEntryIdempotent({
      transactionId: id,
      type: LedgerEntryType.ESCROW_DEBIT_RELEASE,
      amount: tx.escrowAmount,
      note: 'Release: escrow debited (payout simulated)',
      idempotencyKey: releaseKey,
    });

    if (tx.commission > 0) {
      await this.ledger.addEntryIdempotent({
        transactionId: id,
        type: LedgerEntryType.COMMISSION_ACCRUAL,
        amount: tx.commission,
        note: 'Commission accrued',
        idempotencyKey: Idempotency.tx('commission_accrual', id),
      });
    }

    // If entry already existed, it’s still OK (idempotent behavior)
    return {
      ok: true,
      transactionId: tx.id,
      ledgerEntryId: entry.id,
      message: 'Release simulated (idempotent)',
    };
  }

  async getLedger(id: string) {
    await this.prisma.transaction.findUniqueOrThrow({ where: { id } });
    return this.ledger.listByTransaction(id);
  }
}