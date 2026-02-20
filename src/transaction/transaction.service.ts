// src/transaction/transaction.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, TransactionStatus } from '@prisma/client';
import { transitions, canTransition } from './transaction-state-machine';

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

    // Create transaction in CREATED + PENDING
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

  async updateStatus(id: string, next: TransactionStatus) {
    const tx = await this.prisma.transaction.findUniqueOrThrow({ where: { id } });

    if (!canTransition(tx.status, next)) {
      const allowed = transitions[tx.status] ?? [];
      throw new BadRequestException(
        `Invalid transition: ${tx.status} -> ${next}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    return this.prisma.transaction.update({
      where: { id },
      data: { status: next },
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

    // For now: mark as "released" by setting status to DELIVERED (already) and keep paymentStatus SUCCESS.
    // If you want an explicit state, add enum later (e.g. RELEASED) but not now.
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