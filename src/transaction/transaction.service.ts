// src/transaction/transaction.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, TransactionStatus } from '@prisma/client';
import { TransactionStateMachine } from './transaction-state-machine';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(senderId: string, travelerId: string, amount: number) {
    if (!senderId || !travelerId) {
      throw new BadRequestException('senderId and travelerId are required');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }

    return this.prisma.transaction.create({
      data: {
        senderId,
        travelerId,
        amount,
        status: TransactionStatus.CREATED,
        paymentStatus: PaymentStatus.PENDING,
      },
    });
  }

  async findAll() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
    });
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
   * Simple release rule for now:
   * - only when status = DELIVERED and paymentStatus = SUCCESS
   * Later we’ll plug real escrow + ledger.
   */
  async releaseFunds(id: string) {
    const tx = await this.prisma.transaction.findUniqueOrThrow({ where: { id } });

    if (tx.status !== TransactionStatus.DELIVERED) {
      throw new BadRequestException('Funds can only be released after DELIVERED');
    }
    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Payment must be SUCCESS before releasing funds');
    }

    return {
      ok: true,
      transactionId: tx.id,
      message: 'Release simulated (ledger/escrow will be implemented later)',
    };
  }

  /**
   * Optional helper to simulate payment success/failure during dev.
   */
  async markPayment(id: string, paymentStatus: PaymentStatus) {
    return this.prisma.transaction.update({
      where: { id },
      data: { paymentStatus },
    });
  }
}