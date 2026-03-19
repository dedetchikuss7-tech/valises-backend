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
  Prisma,
  Refund,
  RefundProvider,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ManualRefundProvider } from './providers/manual-refund.provider';
import { MockStripeRefundProvider } from './providers/mock-stripe-refund.provider';
import {
  RefundProviderAdapter,
  RefundProviderResult,
} from './refund.provider';
import { ListRefundsQueryDto } from './dto/list-refunds-query.dto';
import { AdminActionAuditService } from '../admin-action-audit/admin-action-audit.service';

@Injectable()
export class RefundService {
  private readonly providers: Map<RefundProvider, RefundProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    manualProvider: ManualRefundProvider,
    mockStripeProvider: MockStripeRefundProvider,
    @Optional()
    private readonly adminActionAuditService?: AdminActionAuditService,
  ) {
    this.providers = new Map<RefundProvider, RefundProviderAdapter>([
      [manualProvider.provider, manualProvider],
      [mockStripeProvider.provider, mockStripeProvider],
    ]);
  }

  async list(query: ListRefundsQueryDto) {
    const where: Prisma.RefundWhereInput = {
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

    return this.prisma.refund.findMany({
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    });
  }

  async getByTransaction(transactionId: string) {
    return this.prisma.refund.findUnique({
      where: { transactionId },
    });
  }

  async getOne(refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
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

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    return refund;
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
      throw new BadRequestException(
        'Cannot request refund: paymentStatus is not SUCCESS',
      );
    }

    const escrowBalance = await this.ledger.getEscrowBalance(transactionId);
    if (escrowBalance <= 0) {
      throw new BadRequestException(
        'Cannot request refund: escrow balance is 0',
      );
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException(
        'Refund amount must be a positive integer',
      );
    }
    if (amount > escrowBalance) {
      throw new BadRequestException(
        `Refund amount exceeds escrow balance (${escrowBalance})`,
      );
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
          requestedAt: null,
          processedAt: null,
          refundedAt: null,
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
        idempotencyKey:
          opts?.idempotencyKey ?? `refund_request:${transactionId}`,
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

  async retry(
    refundId: string,
    input?: {
      provider?: RefundProvider;
      reason?: string | null;
      actorUserId?: string | null;
    },
  ) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (
      refund.status !== RefundStatus.FAILED &&
      refund.status !== RefundStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Only FAILED or CANCELLED refunds can be retried',
      );
    }

    const refreshed = await this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        provider: input?.provider ?? refund.provider,
        status: RefundStatus.READY,
        failureReason: null,
        requestedAt: null,
        processedAt: null,
        refundedAt: null,
        metadata: {
          ...(typeof refund.metadata === 'object' && refund.metadata !== null
            ? (refund.metadata as Record<string, unknown>)
            : {}),
          retriedAt: new Date().toISOString(),
          retryReason: input?.reason ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    const dispatched = await this.dispatchToProvider(refreshed);

    await this.adminActionAuditService?.recordSafe({
      action: 'REFUND_RETRIED',
      targetType: 'REFUND',
      targetId: refund.id,
      actorUserId: input?.actorUserId ?? null,
      metadata: {
        transactionId: refund.transactionId,
        providerBefore: refund.provider,
        providerAfter: dispatched.provider,
        statusAfter: dispatched.status,
        reason: input?.reason ?? null,
      },
    });

    return dispatched;
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

    const updatedRefund = await this.prisma.$transaction(async (dbTx) => {
      const savedRefund = await dbTx.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.REFUNDED,
          refundedAt: new Date(),
          processedAt: new Date(),
          externalReference:
            input?.externalReference ?? refund.externalReference ?? null,
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

      const remainingEscrow = await this.ledger.getEscrowBalance(
        refund.transactionId,
        dbTx,
      );

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

      return savedRefund;
    });

    await this.adminActionAuditService?.recordSafe({
      action: 'REFUND_MARKED_REFUNDED',
      targetType: 'REFUND',
      targetId: refund.id,
      actorUserId: input?.actorUserId ?? null,
      metadata: {
        transactionId: refund.transactionId,
        amount: refund.amount,
        externalReference: input?.externalReference ?? null,
        note: input?.note ?? null,
      },
    });

    return updatedRefund;
  }

  async markFailed(
    refundId: string,
    input: { reason: string; actorUserId?: string | null },
  ) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.status === RefundStatus.REFUNDED) {
      throw new BadRequestException(
        'Cannot mark failed: refund already REFUNDED',
      );
    }

    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.FAILED,
        failureReason: input.reason,
        processedAt: new Date(),
      },
    });

    await this.adminActionAuditService?.recordSafe({
      action: 'REFUND_MARKED_FAILED',
      targetType: 'REFUND',
      targetId: refund.id,
      actorUserId: input.actorUserId ?? null,
      metadata: {
        transactionId: refund.transactionId,
        reason: input.reason,
      },
    });

    return updated;
  }

  private async dispatchToProvider(refund: Refund): Promise<Refund> {
    const provider = this.providers.get(refund.provider);
    if (!provider) {
      throw new BadRequestException(
        `Unsupported refund provider: ${refund.provider}`,
      );
    }

    try {
      const result = await provider.requestRefund({
        refundId: refund.id,
        transactionId: refund.transactionId,
        amount: refund.amount,
        currency: refund.currency,
        provider: refund.provider,
      });

      const normalized = this.normalizeProviderResult(result);

      return this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: normalized.status,
          externalReference: normalized.externalReference,
          requestedAt: new Date(),
          processedAt:
            normalized.status === RefundStatus.PROCESSING ? new Date() : null,
          failureReason: null,
          metadata: normalized.metadata as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      const message = this.extractProviderErrorMessage(error);

      const failed = await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.FAILED,
          failureReason: message,
          processedAt: new Date(),
          metadata: {
            providerError: true,
            providerErrorMessage: message,
          } as Prisma.InputJsonValue,
        },
      });

      await this.adminActionAuditService?.recordSafe({
        action: 'REFUND_PROVIDER_FAILED',
        targetType: 'REFUND',
        targetId: refund.id,
        actorUserId: null,
        metadata: {
          transactionId: refund.transactionId,
          provider: refund.provider,
          error: message,
        },
      });

      return failed;
    }
  }

  private normalizeProviderResult(
    result: RefundProviderResult,
  ): RefundProviderResult {
    if (
      result.status !== RefundStatus.REQUESTED &&
      result.status !== RefundStatus.PROCESSING
    ) {
      throw new BadRequestException(
        `Invalid refund provider status: ${String(result.status)}`,
      );
    }

    const metadata =
      result.metadata && typeof result.metadata === 'object' && !Array.isArray(result.metadata)
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