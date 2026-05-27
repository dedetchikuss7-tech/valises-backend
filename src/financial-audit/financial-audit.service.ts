import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinancialAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getTransactionAuditSnapshot(transactionId: string, adminUserId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction not found: ${transactionId}`);
    }

    const [
      ledgerEntries,
      paymentAttempts,
      payouts,
      dispute,
      reconciliationCases,
      compensationRequests,
      senderFraudFlags,
      travelerFraudFlags,
    ] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { transactionId },
        orderBy: { createdAt: 'asc' },
      }),
      this.loadPaymentAttempts(transactionId),
      this.loadPayouts(transactionId),
      this.loadDispute(transactionId),
      this.loadReconciliationCases(transactionId),
      this.loadCompensationRequests(transactionId),
      this.loadFraudFlags(transaction.senderId),
      this.loadFraudFlags(transaction.travelerId),
    ]);

    await this.logAccess(adminUserId, transactionId);

    return {
      transaction,
      ledgerEntries,
      paymentAttempts,
      payouts,
      dispute,
      reconciliationCases,
      compensationRequests,
      fraudFlags: {
        sender: senderFraudFlags,
        traveler: travelerFraudFlags,
      },
    };
  }

  private async loadPaymentAttempts(transactionId: string) {
    try {
      return await this.prisma.paymentAttempt.findMany({
        where: { transactionId },
        orderBy: { requestedAt: 'asc' },
      });
    } catch {
      return [];
    }
  }

  private async loadPayouts(transactionId: string) {
    try {
      return await this.prisma.payout.findMany({
        where: { transactionId },
        orderBy: { createdAt: 'asc' },
      });
    } catch {
      return [];
    }
  }

  private async loadDispute(transactionId: string) {
    try {
      return (
        (await this.prisma.dispute.findFirst({
          where: { transactionId },
        })) ?? null
      );
    } catch {
      return null;
    }
  }

  private async loadReconciliationCases(transactionId: string) {
    try {
      return await this.prisma.reconciliationCase.findMany({
        where: { transactionId },
        orderBy: { createdAt: 'asc' },
      });
    } catch {
      return [];
    }
  }

  private async loadCompensationRequests(transactionId: string) {
    try {
      return await this.prisma.compensationRequest.findMany({
        where: { transactionId },
        orderBy: { createdAt: 'asc' },
      });
    } catch {
      return [];
    }
  }

  private async loadFraudFlags(userId: string | null) {
    if (!userId) return [];
    try {
      return await this.prisma.fraudFlag.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
    } catch {
      return [];
    }
  }

  private async logAccess(adminUserId: string, transactionId: string) {
    try {
      await this.prisma.auditAccessLog.create({
        data: {
          accessedById: adminUserId,
          targetType: 'TRANSACTION',
          targetId: transactionId,
          endpoint: '/admin/financial-audit/transaction/:id',
        },
      });
    } catch {
      console.warn('[FinancialAudit] Access log skipped for transaction:', transactionId);
    }
  }
}
