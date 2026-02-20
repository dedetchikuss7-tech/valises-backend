import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCanTransition } from './transaction-state-machine';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(senderId: string, travelerId: string, totalAmount: number) {
    if (!senderId || !travelerId) throw new BadRequestException('senderId and travelerId are required');
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new BadRequestException('totalAmount must be a positive number');
    }

    return this.prisma.transaction.create({
      data: {
        senderId,
        travelerId,
        amount: Math.round(totalAmount),
        status: TransactionStatus.CREATED,
        paymentStatus: PaymentStatus.PENDING,
      },
    });
  }

  async markPaid(transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');

    // Paiement validé => status PAID + paymentStatus SUCCESS
    assertCanTransition(tx.status, TransactionStatus.PAID);

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });
  }

  async updateStatus(transactionId: string, nextStatus: TransactionStatus) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');

    assertCanTransition(tx.status, nextStatus);

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: nextStatus },
    });
  }

  async findAll() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  // Simplifié: releaseFunds autorisé uniquement quand DELIVERED
  async releaseFunds(transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');

    if (tx.status !== TransactionStatus.DELIVERED) {
      throw new BadRequestException('Funds can only be released when status is DELIVERED');
    }

    // Ici on ne change rien en DB (pas encore de champs escrow/commission dans ce schema clean)
    // On retourne juste la transaction pour confirmer l’action.
    return tx;
  }
}