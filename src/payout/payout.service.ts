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
  Payout,
  PayoutProvider,
  PayoutStatus,
  Prisma,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ManualPayoutProvider } from './providers/manual-payout.provider';
import { MockStripePayoutProvider } from './providers/mock-stripe-payout.provider';
import { PayoutProviderAdapter } from './payout.provider';

@Injectable()
export class PayoutService {
  private readonly providers: Map<PayoutProvider, PayoutProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    manualProvider: ManualPayoutProvider,
    mockStripeProvider: MockStripePayoutProvider,
  ) {
    this.providers = new Map<PayoutProvider, PayoutProviderAdapter>([
      [manualProvider.provider, manualProvider],
      [mockStripeProvider.provider, mockStripeProvider],
    ]);
  }

  async getByTransaction(transactionId: string) {
    return this.prisma.payout.findUnique({
      where: { transactionId },
    });
  }

  async getOne(payoutId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            escrowAmount: true,
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    return payout;
  }

  async requestPayoutForTransaction(
    transactionId: string,
    provider: PayoutProvider = PayoutProvider.MANUAL,
  ): Promise<Payout> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        escrowAmount: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Cannot request payout: paymentStatus is not SUCCESS');
    }

    if (tx.status !== TransactionStatus.DELIVERED) {
      throw new BadRequestException('Cannot request payout: transaction must be DELIVERED');
    }

    const escrowBalance = await this.ledger.getEscrowBalance(transactionId);
    if (escrowBalance <= 0) {
      throw new BadRequestException('Cannot request payout: escrow balance is 0');
    }

    const existing = await this.prisma.payout.findUnique({
      where: { transactionId },
    });

    if (existing) {
      if (
        existing.status === PayoutStatus.REQUESTED ||
        existing.status === PayoutStatus.PROCESSING ||
        existing.status === PayoutStatus.PAID
      ) {
        return existing;
      }

      const refreshed = await this.prisma.payout.update({
        where: { id: existing.id },
        data: {
          provider,
          status: PayoutStatus.READY,
          amount: escrowBalance,
          currency: 'XAF',
          failureReason: null,
          metadata: {
            refreshedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      return this.dispatchToProvider(refreshed);
    }

    const payout = await this.prisma.payout.create({
      data: {
        transactionId,
        provider,
        status: PayoutStatus.READY,
        amount: escrowBalance,
        currency: 'XAF',
        idempotencyKey: `payout_request:${transactionId}`,
        metadata: {
          createdFrom: 'transaction.releaseFunds',
        } as Prisma.InputJsonValue,
      },
    });

    return this.dispatchToProvider(payout);
  }

  async markPaid(
    payoutId: string,
    input?: {
      externalReference?: string | null;
      note?: string | null;
      actorUserId?: string | null;
    },
  ) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status === PayoutStatus.PAID) {
      return payout;
    }

    if (payout.status === PayoutStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark paid: payout is CANCELLED');
    }

    return this.prisma.$transaction(async (dbTx) => {
      const updatedPayout = await dbTx.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.PAID,
          paidAt: new Date(),
          processedAt: new Date(),
          externalReference: input?.externalReference ?? payout.externalReference ?? null,
          failureReason: null,
          metadata: {
            note: input?.note ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      await this.ledger.addEntryIdempotent(
        {
          transactionId: payout.transactionId,
          type: LedgerEntryType.ESCROW_DEBIT_RELEASE,
          amount: payout.amount,
          currency: payout.currency,
          note: input?.note ?? 'Payout completed and escrow released',
          idempotencyKey: `payout_paid:${payout.transactionId}`,
          source: LedgerSource.RELEASE,
          referenceType: LedgerReferenceType.OTHER,
          referenceId: payout.id,
          actorUserId: input?.actorUserId ?? null,
        },
        dbTx,
      );

      await dbTx.transaction.update({
        where: { id: payout.transactionId },
        data: {
          escrowAmount: 0,
        },
      });

      return updatedPayout;
    });
  }

  async markFailed(
    payoutId: string,
    input: { reason: string },
  ) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status === PayoutStatus.PAID) {
      throw new BadRequestException('Cannot mark failed: payout already PAID');
    }

    return this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.FAILED,
        failureReason: input.reason,
        processedAt: new Date(),
      },
    });
  }

  private async dispatchToProvider(payout: Payout): Promise<Payout> {
    const provider = this.providers.get(payout.provider);
    if (!provider) {
      throw new BadRequestException(`Unsupported payout provider: ${payout.provider}`);
    }

    const result = await provider.requestPayout({
      payoutId: payout.id,
      transactionId: payout.transactionId,
      amount: payout.amount,
      currency: payout.currency,
      provider: payout.provider,
    });

    return this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: result.status,
        externalReference: result.externalReference ?? null,
        requestedAt: new Date(),
        processedAt:
          result.status === PayoutStatus.PROCESSING ? new Date() : null,
        metadata: (result.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}