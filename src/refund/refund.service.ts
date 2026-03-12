import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerEntryType,
  LedgerReferenceType,
  LedgerSource,
  PaymentStatus,
  Prisma,
  Refund,
  RefundProvider,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ManualRefundProvider } from './providers/manual-refund.provider';
import { MockStripeRefundProvider } from './providers/mock-stripe-refund.provider';
import { RefundProviderAdapter } from './refund.provider';

@Injectable()
export class RefundService {
  private readonly providers: Map<RefundProvider, RefundProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    manualProvider: ManualRefundProvider,
    mockStripeProvider: MockStripeRefundProvider,
  ) {
    this.providers = new Map<RefundProvider, RefundProviderAdapter>([
      [manualProvider.provider, manualProvider],
      [mockStripeProvider.provider, mockStripeProvider],
    ]);
  }

  async getByTransaction(transactionId: string) {
    return this.prisma.refund.findUnique({
      where: { transactionId },
    });
  }

  async requestRefundForTransaction(
    transactionId: string,
    amount: number,
    provider: RefundProvider = RefundProvider.MANUAL,
    opts?: {
      referenceId?: string | null;
      reason?: string | null;
      metadata?: Record<string, unknown>;
      idempotencyKey?: string;
    },
  ): Promise<Refund> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        paymentStatus: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Cannot request refund: paymentStatus is not SUCCESS');
    }

    const escrowBalance = await this.ledger.getEscrowBalance(transactionId);
    if (escrowBalance <= 0) {
      throw new BadRequestException('Cannot request refund: escrow balance is 0');
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Refund amount must be a positive integer');
    }
    if (amount > escrowBalance) {
      throw new BadRequestException(`Refund amount exceeds escrow balance (${escrowBalance})`);
    }

    const existing = await this.prisma.refund.findUnique({
      where: { transactionId },
    });

    if (existing) {
      if (
        existing.status === RefundStatus.REQUESTED ||
        existing.status === RefundStatus.PROCESSING ||
        existing.status === RefundStatus.REFUNDED
      ) {
        return existing;
      }

      const refreshed = await this.prisma.refund.update({
        where: { id: existing.id },
        data: {
          provider,
          status: RefundStatus.READY,
          amount,
          currency: 'XAF',
          failureReason: null,
          metadata: {
            refreshedAt: new Date().toISOString(),
            reason: opts?.reason ?? null,
            referenceId: opts?.referenceId ?? null,
            ...(opts?.metadata ?? {}),
          } as Prisma.InputJsonValue,
          idempotencyKey: opts?.idempotencyKey ?? existing.idempotencyKey,
        },
      });

      return this.dispatchToProvider(refreshed);
    }

    const refund = await this.prisma.refund.create({
      data: {
        transactionId,
        provider,
        status: RefundStatus.READY,
        amount,
        currency: 'XAF',
        idempotencyKey: opts?.idempotencyKey ?? `refund_request:${transactionId}`,
        metadata: {
          createdFrom: 'refund.request',
          reason: opts?.reason ?? null,
          referenceId: opts?.referenceId ?? null,
          ...(opts?.metadata ?? {}),
        } as Prisma.InputJsonValue,
      },
    });

    return this.dispatchToProvider(refund);
  }

  async markRefunded(
    refundId: string,
    input?: {
      externalReference?: string | null;
      note?: string | null;
      actorUserId?: string | null;
    },
  ) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        transaction: {
          select: {
            id: true,
            amount: true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.status === RefundStatus.REFUNDED) {
      return refund;
    }

    if (refund.status === RefundStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark refunded: refund is CANCELLED');
    }

    return this.prisma.$transaction(async (dbTx) => {
      const updatedRefund = await dbTx.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.REFUNDED,
          refundedAt: new Date(),
          processedAt: new Date(),
          externalReference: input?.externalReference ?? refund.externalReference ?? null,
          failureReason: null,
          metadata: {
            note: input?.note ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      await this.ledger.addEntryIdempotent(
        {
          transactionId: refund.transactionId,
          type: LedgerEntryType.ESCROW_DEBIT_REFUND,
          amount: refund.amount,
          currency: refund.currency,
          note: input?.note ?? 'Refund completed and escrow refunded',
          idempotencyKey: `refund_refunded:${refund.transactionId}:${refund.id}`,
          source: LedgerSource.DISPUTE,
          referenceType: LedgerReferenceType.OTHER,
          referenceId: refund.id,
          actorUserId: input?.actorUserId ?? null,
        },
        dbTx,
      );

      const remainingEscrow = await this.ledger.getEscrowBalance(refund.transactionId, dbTx);

      await dbTx.transaction.update({
        where: { id: refund.transactionId },
        data: {
          escrowAmount: remainingEscrow,
          paymentStatus:
            remainingEscrow === 0 && refund.amount === refund.transaction.amount
              ? PaymentStatus.REFUNDED
              : refund.transaction.paymentStatus,
        },
      });

      return updatedRefund;
    });
  }

  async markFailed(
    refundId: string,
    input: { reason: string },
  ) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.status === RefundStatus.REFUNDED) {
      throw new BadRequestException('Cannot mark failed: refund already REFUNDED');
    }

    return this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.FAILED,
        failureReason: input.reason,
        processedAt: new Date(),
      },
    });
  }

  private async dispatchToProvider(refund: Refund): Promise<Refund> {
    const provider = this.providers.get(refund.provider);
    if (!provider) {
      throw new BadRequestException(`Unsupported refund provider: ${refund.provider}`);
    }

    const result = await provider.requestRefund({
      refundId: refund.id,
      transactionId: refund.transactionId,
      amount: refund.amount,
      currency: refund.currency,
      provider: refund.provider,
    });

    return this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: result.status,
        externalReference: result.externalReference ?? null,
        requestedAt: new Date(),
        processedAt:
          result.status === 'PROCESSING' ? new Date() : null,
        metadata: (result.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}