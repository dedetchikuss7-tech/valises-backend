import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerEntryType, PaymentStatus, TransactionStatus } from '@prisma/client';
import { TransactionStateMachine } from './transaction-state-machine';
import { LedgerService } from '../ledger/ledger.service';

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

  // DEV helper: simulate payment status
  async markPayment(id: string, paymentStatus: PaymentStatus) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');

    await this.prisma.transaction.update({
      where: { id },
      data: { paymentStatus },
    });

    if (paymentStatus === PaymentStatus.SUCCESS) {
      if (tx.status === TransactionStatus.CREATED) {
        await this.updateStatus(id, TransactionStatus.PAID);
      }

      // Ledger: escrow credited once payment confirmed
      await this.ledger.addEntry({
        transactionId: id,
        type: LedgerEntryType.ESCROW_CREDIT,
        amount: tx.escrowAmount,
        note: 'Payment confirmed: escrow credited',
      });
    }

    return this.prisma.transaction.findUniqueOrThrow({ where: { id } });
  }

  async releaseFunds(id: string) {
    const tx = await this.prisma.transaction.findUniqueOrThrow({ where: { id } });

    if (tx.status !== TransactionStatus.DELIVERED) {
      throw new BadRequestException('Funds can only be released after DELIVERED');
    }
    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Payment must be SUCCESS before releasing funds');
    }

    // Ledger: escrow debited for payout (simulated)
    await this.ledger.addEntry({
      transactionId: id,
      type: LedgerEntryType.ESCROW_DEBIT,
      amount: tx.escrowAmount,
      note: 'Release: escrow debited (payout simulated)',
    });

    // Commission (0 for now, but code ready)
    if (tx.commission > 0) {
      await this.ledger.addEntry({
        transactionId: id,
        type: LedgerEntryType.COMMISSION_ACCRUAL,
        amount: tx.commission,
        note: 'Commission accrued',
      });
    }

    return { ok: true, transactionId: tx.id, message: 'Release simulated + ledger written' };
  }

  async getLedger(id: string) {
    await this.prisma.transaction.findUniqueOrThrow({ where: { id } });
    return this.ledger.listByTransaction(id);
  }
}