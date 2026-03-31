import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
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
import {
  PayoutProviderAdapter,
  PayoutProviderResult,
} from './payout.provider';
import { ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import { AdminActionAuditService } from '../admin-action-audit/admin-action-audit.service';

@Injectable()
export class PayoutService {
  private readonly providers: Map<PayoutProvider, PayoutProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    manualProvider: ManualPayoutProvider,
    mockStripeProvider: MockStripePayoutProvider,
    @Optional()
    private readonly adminActionAuditService?: AdminActionAuditService,
  ) {
    this.providers = new Map<PayoutProvider, PayoutProviderAdapter>([
      [manualProvider.provider, manualProvider],
      [mockStripeProvider.provider, mockStripeProvider],
    ]);
  }

  async list(query: ListPayoutsQueryDto) {
    const where: Prisma.PayoutWhereInput = {
      transactionId: query.transactionId,
      status: query.status,
      provider: query.provider,
      ...(query.fromDate || query.toDate
        ? {
            createdAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
    };

    return this.prisma.payout.findMany({
      where,
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            escrowAmount: true,
            senderId: true,
            travelerId: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    });
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
            currency: true,
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
    opts?: {
      amount?: number;
      referenceId?: string | null;
      reason?: string | null;
      metadata?: Record<string, unknown>;
      idempotencyKey?: string;
      actorUserId?: string | null;
    },
  ): Promise<Payout> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        escrowAmount: true,
        currency: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (
      tx.status !== TransactionStatus.DELIVERED &&
      tx.status !== TransactionStatus.DISPUTED
    ) {
      throw new BadRequestException(
        'Cannot request payout: transaction status must be DELIVERED or DISPUTED',
      );
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Cannot request payout: paymentStatus is not SUCCESS',
      );
    }

    const escrowBalance = await this.ledger.getEscrowBalance(transactionId);
    if (escrowBalance <= 0) {
      throw new BadRequestException(
        'Cannot request payout: escrow balance is 0',
      );
    }

    const amount = opts?.amount ?? escrowBalance;
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException(
        'Payout amount must be a positive integer',
      );
    }
    if (amount > escrowBalance) {
      throw new BadRequestException(
        `Payout amount exceeds escrow balance (${escrowBalance})`,
      );
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
          amount,
          currency: tx.currency,
          failureReason: null,
          metadata: {
            refreshedAt: new Date().toISOString(),
            reason: opts?.reason ?? null,
            referenceId: opts?.referenceId ?? null,
            ...(opts?.metadata ?? {}),
          } as Prisma.InputJsonValue,
          idempotencyKey: opts?.idempotencyKey ?? existing.idempotencyKey,
          requestedAt: null,
          processedAt: null,
          paidAt: null,
        },
      });

      const dispatched = await this.dispatchToProvider(refreshed);

      await this.adminActionAuditService?.recordSafe({
        action: 'PAYOUT_REQUESTED',
        targetType: 'PAYOUT',
        targetId: dispatched.id,
        actorUserId: opts?.actorUserId ?? null,
        metadata: {
          transactionId,
          provider: dispatched.provider,
          statusAfter: dispatched.status,
          amount: dispatched.amount,
          currency: dispatched.currency,
          reason: opts?.reason ?? null,
          referenceId: opts?.referenceId ?? null,
        },
      });

      return dispatched;
    }

    const payout = await this.prisma.payout.create({
      data: {
        transactionId,
        provider,
        status: PayoutStatus.READY,
        amount,
        currency: tx.currency,
        idempotencyKey:
          opts?.idempotencyKey ?? `payout_request:${transactionId}`,
        metadata: {
          createdFrom: 'payout.request',
          reason: opts?.reason ?? null,
          referenceId: opts?.referenceId ?? null,
          ...(opts?.metadata ?? {}),
        } as Prisma.InputJsonValue,
      },
    });

    const dispatched = await this.dispatchToProvider(payout);

    await this.adminActionAuditService?.recordSafe({
      action: 'PAYOUT_REQUESTED',
      targetType: 'PAYOUT',
      targetId: dispatched.id,
      actorUserId: opts?.actorUserId ?? null,
      metadata: {
        transactionId,
        provider: dispatched.provider,
        statusAfter: dispatched.status,
        amount: dispatched.amount,
        currency: dispatched.currency,
        reason: opts?.reason ?? null,
        referenceId: opts?.referenceId ?? null,
      },
    });

    return dispatched;
  }

  async retry(
    payoutId: string,
    input?: {
      provider?: PayoutProvider;
      reason?: string | null;
      actorUserId?: string | null;
    },
  ) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (
      payout.status !== PayoutStatus.FAILED &&
      payout.status !== PayoutStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Only FAILED or CANCELLED payouts can be retried',
      );
    }

    const refreshed = await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        provider: input?.provider ?? payout.provider,
        status: PayoutStatus.READY,
        failureReason: null,
        requestedAt: null,
        processedAt: null,
        paidAt: null,
        metadata: {
          ...(typeof payout.metadata === 'object' && payout.metadata !== null
            ? (payout.metadata as Record<string, unknown>)
            : {}),
          retriedAt: new Date().toISOString(),
          retryReason: input?.reason ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    const dispatched = await this.dispatchToProvider(refreshed);

    await this.adminActionAuditService?.recordSafe({
      action: 'PAYOUT_RETRIED',
      targetType: 'PAYOUT',
      targetId: payout.id,
      actorUserId: input?.actorUserId ?? null,
      metadata: {
        transactionId: payout.transactionId,
        providerBefore: payout.provider,
        providerAfter: dispatched.provider,
        statusAfter: dispatched.status,
        reason: input?.reason ?? null,
      },
    });

    return dispatched;
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
            currency: true,
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

    const updatedPayout = await this.prisma.$transaction(async (dbTx) => {
      const savedPayout = await dbTx.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.PAID,
          paidAt: new Date(),
          processedAt: new Date(),
          externalReference:
            input?.externalReference ?? payout.externalReference ?? null,
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
          idempotencyKey: `payout_paid:${payout.transactionId}:${payout.id}`,
          source: LedgerSource.RELEASE,
          referenceType: LedgerReferenceType.OTHER,
          referenceId: payout.id,
          actorUserId: input?.actorUserId ?? null,
        },
        dbTx,
      );

      const remainingEscrow = await this.ledger.getEscrowBalance(
        payout.transactionId,
        dbTx,
      );

      await dbTx.transaction.update({
        where: { id: payout.transactionId },
        data: {
          escrowAmount: remainingEscrow,
        },
      });

      return savedPayout;
    });

    await this.adminActionAuditService?.recordSafe({
      action: 'PAYOUT_MARKED_PAID',
      targetType: 'PAYOUT',
      targetId: payout.id,
      actorUserId: input?.actorUserId ?? null,
      metadata: {
        transactionId: payout.transactionId,
        amount: payout.amount,
        currency: payout.currency,
        externalReference: input?.externalReference ?? null,
        note: input?.note ?? null,
      },
    });

    return updatedPayout;
  }

  async markFailed(
    payoutId: string,
    input: { reason: string; actorUserId?: string | null },
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

    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.FAILED,
        failureReason: input.reason,
        processedAt: new Date(),
      },
    });

    await this.adminActionAuditService?.recordSafe({
      action: 'PAYOUT_MARKED_FAILED',
      targetType: 'PAYOUT',
      targetId: payout.id,
      actorUserId: input.actorUserId ?? null,
      metadata: {
        transactionId: payout.transactionId,
        reason: input.reason,
      },
    });

    return updated;
  }

  private async dispatchToProvider(payout: Payout): Promise<Payout> {
    const provider = this.providers.get(payout.provider);
    if (!provider) {
      throw new BadRequestException(
        `Unsupported payout provider: ${payout.provider}`,
      );
    }

    try {
      const result = await provider.requestPayout({
        payoutId: payout.id,
        transactionId: payout.transactionId,
        amount: payout.amount,
        currency: payout.currency,
        provider: payout.provider,
      });

      const normalized = this.normalizeProviderResult(result);

      return this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: normalized.status,
          externalReference: normalized.externalReference,
          requestedAt: new Date(),
          processedAt:
            normalized.status === PayoutStatus.PROCESSING ? new Date() : null,
          failureReason: null,
          metadata: normalized.metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      const message = this.extractProviderErrorMessage(error);

      const failed = await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.FAILED,
          failureReason: message,
          processedAt: new Date(),
          metadata: {
            providerError: true,
            providerErrorMessage: message,
          } as Prisma.InputJsonValue,
        },
      });

      await this.adminActionAuditService?.recordSafe({
        action: 'PAYOUT_PROVIDER_FAILED',
        targetType: 'PAYOUT',
        targetId: payout.id,
        actorUserId: null,
        metadata: {
          transactionId: payout.transactionId,
          provider: payout.provider,
          error: message,
        },
      });

      return failed;
    }
  }

  private normalizeProviderResult(
    result: PayoutProviderResult,
  ): PayoutProviderResult {
    if (
      result.status !== PayoutStatus.REQUESTED &&
      result.status !== PayoutStatus.PROCESSING
    ) {
      throw new BadRequestException(
        `Invalid payout provider status: ${String(result.status)}`,
      );
    }

    const metadata =
      result.metadata &&
      typeof result.metadata === 'object' &&
      !Array.isArray(result.metadata)
        ? result.metadata
        : {};

    const externalReference =
      typeof result.externalReference === 'string'
        ? result.externalReference
        : result.externalReference ?? null;

    return {
      status: result.status,
      externalReference,
      metadata,
    };
  }

  private extractProviderErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Provider request failed';
  }
}