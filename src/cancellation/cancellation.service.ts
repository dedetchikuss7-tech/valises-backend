import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { LedgerEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SENDER_CANCELLABLE_STATUSES = ['CREATED', 'PAID'];

@Injectable()
export class CancellationService {
  constructor(private readonly prisma: PrismaService) {}

  async cancelTransaction(transactionId: string, requestingUserId: string): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction not found: ${transactionId}`);
      }

      if (transaction.senderId !== requestingUserId) {
        throw new ForbiddenException('Only the sender can cancel this transaction.');
      }

      if (!SENDER_CANCELLABLE_STATUSES.includes(transaction.status)) {
        throw new BadRequestException(
          `Cannot cancel a transaction with status: ${transaction.status}. ` +
          `Cancellable statuses: ${SENDER_CANCELLABLE_STATUSES.join(', ')}`,
        );
      }

      const updated = await tx.transaction.update({
        where: {
          id: transactionId,
          status: { in: SENDER_CANCELLABLE_STATUSES as any },
        },
        data: { status: 'CANCELLED' },
      });

      if (transaction.status === 'PAID' || transaction.paymentStatus === 'SUCCESS') {
        await this.createRefundLedgerEntry(tx, transaction);
      }

      await this.recordAudit(tx, {
        actorUserId: requestingUserId,
        action: 'TRANSACTION_CANCELLED',
        targetType: 'TRANSACTION',
        targetId: transactionId,
        metadata: { previousStatus: transaction.status, cancelledBy: 'SENDER' },
      });

      return updated;
    });
  }

  async forceCancelTransaction(transactionId: string, adminUserId: string): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction not found: ${transactionId}`);
      }

      if (transaction.status === 'CANCELLED') {
        throw new BadRequestException('Transaction is already cancelled.');
      }

      if (transaction.status === 'DELIVERED') {
        throw new BadRequestException('Cannot force-cancel a delivered transaction.');
      }

      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: 'CANCELLED' },
      });

      if (transaction.paymentStatus === 'SUCCESS') {
        await this.createRefundLedgerEntry(tx, transaction);
      }

      await this.recordAudit(tx, {
        actorUserId: adminUserId,
        action: 'TRANSACTION_FORCE_CANCELLED',
        targetType: 'TRANSACTION',
        targetId: transactionId,
        metadata: { previousStatus: transaction.status, cancelledBy: 'ADMIN' },
      });

      return updated;
    });
  }

  private async createRefundLedgerEntry(tx: any, transaction: any): Promise<void> {
    const idempotencyKey = `refund:${transaction.id}`;

    const existing = await tx.ledgerEntry.findUnique({
      where: {
        transactionId_idempotencyKey: {
          transactionId: transaction.id,
          idempotencyKey,
        },
      },
    });
    if (existing) return;

    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        type: LedgerEntryType.ESCROW_DEBIT_REFUND,
        amount: transaction.amount,
        idempotencyKey,
        note: `Refund for cancelled transaction ${transaction.id}`,
      },
    });
  }

  private async recordAudit(tx: any, event: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    try {
      await tx.adminActionAudit.create({
        data: {
          actorUserId: event.actorUserId,
          action: event.action,
          targetType: event.targetType,
          targetId: event.targetId,
          metadata: event.metadata,
        },
      });
    } catch {
      console.warn('[Cancellation] Audit trail skipped:', event.action);
    }
  }
}
