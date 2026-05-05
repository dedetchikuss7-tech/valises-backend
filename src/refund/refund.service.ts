import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  DisputeStatus,
  LedgerEntryType,
  LedgerReferenceType,
  LedgerSource,
  PaymentStatus,
  Prisma,
  ProviderEventObjectType,
  ProviderEventProcessingStatus,
  Refund,
  RefundProvider,
  RefundStatus,
  TransactionStatus,
  PayoutStatus,
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

type IngestRefundProviderEventInput = {
  provider: RefundProvider;
  eventType: string;
  idempotencyKey: string;
  refundId?: string | null;
  transactionId?: string | null;
  externalReference?: string | null;
  occurredAt?: string | null;
  payload?: Record<string, unknown>;
  actorUserId?: string | null;
};

type NormalizedRefundEventKind =
  | 'REQUESTED'
  | 'PROCESSING'
  | 'REFUNDED'
  | 'FAILED'
  | 'UNKNOWN';

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

  private buildTransactionSnapshot(transaction: any) {
    if (!transaction) {
      return null;
    }

    return {
      id: transaction.id,
      status: transaction.status,
      paymentStatus: transaction.paymentStatus,
      escrowAmount: transaction.escrowAmount,
      senderId: transaction.senderId,
      travelerId: transaction.travelerId,
      currency: transaction.currency,
    };
  }

  private buildAdminOperationalSnapshot(input: {
    dispute: any | null;
    payout: any | null;
    refund: any | null;
  }) {
    const hasOpenDispute = input.dispute?.status === DisputeStatus.OPEN;

    const hasRequestedPayout =
      input.payout?.status === PayoutStatus.REQUESTED ||
      input.payout?.status === PayoutStatus.PROCESSING;

    const hasRequestedRefund =
      input.refund?.status === RefundStatus.REQUESTED ||
      input.refund?.status === RefundStatus.PROCESSING;

    return {
      hasOpenDispute,
      hasRequestedPayout,
      hasRequestedRefund,
      requiresAdminAttention:
        hasOpenDispute || hasRequestedPayout || hasRequestedRefund,
    };
  }

  private async enrichReadModels(items: any[]) {
    if (items.length === 0) {
      return [];
    }

    const canReadRelatedModels =
      typeof (this.prisma as any).payout?.findMany === 'function' &&
      typeof (this.prisma as any).dispute?.findMany === 'function';

    if (!canReadRelatedModels) {
      return items.map((item) => ({
        ...item,
        transactionSnapshot: this.buildTransactionSnapshot(item.transaction),
        adminOperationalSnapshot: this.buildAdminOperationalSnapshot({
          dispute: null,
          payout: null,
          refund: item,
        }),
      }));
    }

    const transactionIds = Array.from(
      new Set(
        items
          .map((item) => item.transactionId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const [payouts, disputes] = await Promise.all([
      this.prisma.payout.findMany({
        where: {
          transactionId: { in: transactionIds },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dispute.findMany({
        where: {
          transactionId: { in: transactionIds },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const latestPayoutByTransactionId = new Map<string, any>();
    for (const payout of payouts) {
      if (!latestPayoutByTransactionId.has(payout.transactionId)) {
        latestPayoutByTransactionId.set(payout.transactionId, payout);
      }
    }

    const latestDisputeByTransactionId = new Map<string, any>();
    for (const dispute of disputes) {
      if (!latestDisputeByTransactionId.has(dispute.transactionId)) {
        latestDisputeByTransactionId.set(dispute.transactionId, dispute);
      }
    }

    return items.map((item) => {
      const payout = latestPayoutByTransactionId.get(item.transactionId) ?? null;
      const dispute =
        latestDisputeByTransactionId.get(item.transactionId) ?? null;

      return {
        ...item,
        transactionSnapshot: this.buildTransactionSnapshot(item.transaction),
        adminOperationalSnapshot: this.buildAdminOperationalSnapshot({
          dispute,
          payout,
          refund: item,
        }),
      };
    });
  }

  private mergeMetadata(
    current: Prisma.JsonValue | null | undefined,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const base =
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
        ? (current as Record<string, unknown>)
        : {};

    return {
      ...base,
      ...patch,
    } as Prisma.InputJsonValue;
  }

  private classifyProviderEventType(eventType: string): NormalizedRefundEventKind {
    const normalized = eventType.trim().toLowerCase();

    if (normalized === 'refund.requested' || normalized === 'requested') {
      return 'REQUESTED';
    }

    if (normalized === 'refund.processing' || normalized === 'processing') {
      return 'PROCESSING';
    }

    if (
      normalized === 'refund.refunded' ||
      normalized === 'refunded' ||
      normalized === 'refund.succeeded' ||
      normalized === 'succeeded' ||
      normalized === 'success'
    ) {
      return 'REFUNDED';
    }

    if (normalized === 'refund.failed' || normalized === 'failed') {
      return 'FAILED';
    }

    return 'UNKNOWN';
  }

  private coerceOccurredAt(raw?: string | null): Date {
    if (!raw) {
      return new Date();
    }

    const value = new Date(raw);

    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException('occurredAt must be a valid ISO date string');
    }

    return value;
  }

  private async resolveRefundByProviderEventIdentifiers(input: {
    refundId?: string | null;
    transactionId?: string | null;
    externalReference?: string | null;
  }) {
    const select = {
      id: true,
      transactionId: true,
      provider: true,
      status: true,
      amount: true,
      currency: true,
      idempotencyKey: true,
      externalReference: true,
      failureReason: true,
      metadata: true,
      requestedAt: true,
      processedAt: true,
      refundedAt: true,
    } as const;

    if (input.refundId) {
      const refund = await this.prisma.refund.findUnique({
        where: { id: input.refundId },
        select,
      });

      if (refund) {
        return refund;
      }
    }

    if (input.externalReference) {
      const refund = await this.prisma.refund.findFirst({
        where: { externalReference: input.externalReference },
        select,
      });

      if (refund) {
        return refund;
      }
    }

    if (input.transactionId) {
      const refund = await this.prisma.refund.findUnique({
        where: { transactionId: input.transactionId },
        select,
      });

      if (refund) {
        return refund;
      }
    }

    return null;
  }

  private async markProviderEventApplied(
    providerEventId: string,
    processingStatus: ProviderEventProcessingStatus,
    failureReason?: string | null,
  ) {
    return this.prisma.providerEvent.update({
      where: { id: providerEventId },
      data: {
        processingStatus,
        failureReason: failureReason ?? null,
        appliedAt:
          processingStatus === ProviderEventProcessingStatus.APPLIED ||
          processingStatus === ProviderEventProcessingStatus.IGNORED
            ? new Date()
            : null,
      },
    });
  }

  private async applyProviderEventToRefund(input: {
    refund: any;
    provider: RefundProvider;
    eventType: string;
    idempotencyKey: string;
    occurredAt: Date;
    externalReference?: string | null;
    payload?: Record<string, unknown>;
    actorUserId?: string | null;
  }) {
    const kind = this.classifyProviderEventType(input.eventType);

    if (kind === 'UNKNOWN') {
      return {
        refund: input.refund,
        action: 'IGNORED_UNKNOWN_EVENT_TYPE',
        processingStatus: ProviderEventProcessingStatus.IGNORED,
        failureReason: `Unsupported refund provider event type: ${input.eventType}`,
      };
    }

    if (
      (kind === 'REQUESTED' || kind === 'PROCESSING') &&
      input.refund.status === RefundStatus.REFUNDED
    ) {
      return {
        refund: input.refund,
        action: 'IGNORED_TERMINAL_REFUND',
        processingStatus: ProviderEventProcessingStatus.IGNORED,
        failureReason: null,
      };
    }

    if (kind === 'REFUNDED') {
      if (input.refund.status === RefundStatus.REFUNDED) {
        return {
          refund: input.refund,
          action: 'ALREADY_REFUNDED',
          processingStatus: ProviderEventProcessingStatus.IGNORED,
          failureReason: null,
        };
      }

      if (input.refund.status === RefundStatus.CANCELLED) {
        return {
          refund: input.refund,
          action: 'IGNORED_CANCELLED_REFUND',
          processingStatus: ProviderEventProcessingStatus.IGNORED,
          failureReason: null,
        };
      }

      const updated = await this.markRefunded(input.refund.id, {
        externalReference:
          input.externalReference ?? input.refund.externalReference ?? null,
        note: `Provider event applied: ${input.eventType}`,
        actorUserId: input.actorUserId ?? null,
      });

      return {
        refund: updated,
        action: 'MARKED_REFUNDED',
        processingStatus: ProviderEventProcessingStatus.APPLIED,
        failureReason: null,
      };
    }

    if (kind === 'FAILED') {
      if (input.refund.status === RefundStatus.REFUNDED) {
        return {
          refund: input.refund,
          action: 'IGNORED_ALREADY_REFUNDED',
          processingStatus: ProviderEventProcessingStatus.IGNORED,
          failureReason: null,
        };
      }

      if (input.refund.status === RefundStatus.CANCELLED) {
        return {
          refund: input.refund,
          action: 'IGNORED_CANCELLED_REFUND',
          processingStatus: ProviderEventProcessingStatus.IGNORED,
          failureReason: null,
        };
      }

      if (input.refund.status === RefundStatus.FAILED) {
        return {
          refund: input.refund,
          action: 'ALREADY_FAILED',
          processingStatus: ProviderEventProcessingStatus.IGNORED,
          failureReason: null,
        };
      }

      const updated = await this.markFailed(input.refund.id, {
        reason: `Provider event applied: ${input.eventType}`,
        actorUserId: input.actorUserId ?? null,
      });

      return {
        refund: updated,
        action: 'MARKED_FAILED',
        processingStatus: ProviderEventProcessingStatus.APPLIED,
        failureReason: null,
      };
    }

    const nextStatus =
      kind === 'PROCESSING' ? RefundStatus.PROCESSING : RefundStatus.REQUESTED;

    const updated = await this.prisma.refund.update({
      where: { id: input.refund.id },
      data: {
        status: nextStatus,
        externalReference:
          input.externalReference ?? input.refund.externalReference ?? null,
        requestedAt: input.refund.requestedAt ?? input.occurredAt,
        processedAt:
          kind === 'PROCESSING'
            ? input.occurredAt
            : input.refund.processedAt ?? null,
        failureReason: null,
        metadata: this.mergeMetadata(input.refund.metadata, {
          lastProviderEventType: input.eventType,
          lastProviderEventProvider: input.provider,
          lastProviderEventOccurredAt: input.occurredAt.toISOString(),
          lastProviderEventIdempotencyKey: input.idempotencyKey,
          lastProviderEventPayload: input.payload ?? {},
        }),
      },
    });

    return {
      refund: updated,
      action:
        kind === 'PROCESSING' ? 'MARKED_PROCESSING' : 'MARKED_REQUESTED',
      processingStatus: ProviderEventProcessingStatus.APPLIED,
      failureReason: null,
    };
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

    const refunds = await this.prisma.refund.findMany({
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

    return this.enrichReadModels(refunds);
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
            currency: true,
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    const [enriched] = await this.enrichReadModels([refund]);
    return enriched;
  }

  async ingestProviderEvent(input: IngestRefundProviderEventInput) {
    if (
      !input.refundId &&
      !input.transactionId &&
      !input.externalReference
    ) {
      throw new BadRequestException(
        'At least one identifier is required: refundId, transactionId, or externalReference',
      );
    }

    const existing = await this.prisma.providerEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: {
        refund: true,
        transaction: true,
      },
    });

    if (existing) {
      return {
        providerEvent: existing,
        refund: existing.refund ?? null,
        appliedAction: 'IDEMPOTENT_REPLAY',
      };
    }

    const occurredAt = this.coerceOccurredAt(input.occurredAt);
    const refund = await this.resolveRefundByProviderEventIdentifiers({
      refundId: input.refundId ?? null,
      transactionId: input.transactionId ?? null,
      externalReference: input.externalReference ?? null,
    });

    const providerEvent = await this.prisma.providerEvent.create({
      data: {
        provider: input.provider,
        objectType: ProviderEventObjectType.REFUND,
        eventType: input.eventType.trim(),
        idempotencyKey: input.idempotencyKey,
        objectReference:
          refund?.id ??
          input.externalReference ??
          input.transactionId ??
          input.refundId ??
          null,
        externalReference: input.externalReference ?? null,
        transactionId: refund?.transactionId ?? null,
        refundId: refund?.id ?? null,
        occurredAt,
        processingStatus: ProviderEventProcessingStatus.RECEIVED,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      },
    });

    if (!refund) {
      const ignored = await this.markProviderEventApplied(
        providerEvent.id,
        ProviderEventProcessingStatus.IGNORED,
        'No refund matched the provided identifiers',
      );

      await this.adminActionAuditService?.recordSafe({
        action: 'REFUND_PROVIDER_EVENT_IGNORED',
        targetType: 'PROVIDER_EVENT',
        targetId: ignored.id,
        actorUserId: input.actorUserId ?? null,
        metadata: {
          provider: input.provider,
          eventType: input.eventType,
          reason: 'No refund matched the provided identifiers',
          idempotencyKey: input.idempotencyKey,
        },
      });

      return {
        providerEvent: ignored,
        refund: null,
        appliedAction: 'IGNORED_NO_MATCH',
      };
    }

    try {
      const applied = await this.applyProviderEventToRefund({
        refund,
        provider: input.provider,
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
        occurredAt,
        externalReference: input.externalReference ?? null,
        payload: input.payload ?? {},
        actorUserId: input.actorUserId ?? null,
      });

      const savedEvent = await this.markProviderEventApplied(
        providerEvent.id,
        applied.processingStatus,
        applied.failureReason ?? null,
      );

      await this.adminActionAuditService?.recordSafe({
        action: 'REFUND_PROVIDER_EVENT_INGESTED',
        targetType: 'PROVIDER_EVENT',
        targetId: savedEvent.id,
        actorUserId: input.actorUserId ?? null,
        metadata: {
          provider: input.provider,
          eventType: input.eventType,
          refundId: refund.id,
          transactionId: refund.transactionId,
          appliedAction: applied.action,
          idempotencyKey: input.idempotencyKey,
        },
      });

      return {
        providerEvent: savedEvent,
        refund: applied.refund,
        appliedAction: applied.action,
      };
    } catch (error) {
      const message = this.extractProviderErrorMessage(error);

      const failedEvent = await this.prisma.providerEvent.update({
        where: { id: providerEvent.id },
        data: {
          processingStatus: ProviderEventProcessingStatus.FAILED,
          failureReason: message,
        },
      });

      await this.adminActionAuditService?.recordSafe({
        action: 'REFUND_PROVIDER_EVENT_FAILED',
        targetType: 'PROVIDER_EVENT',
        targetId: failedEvent.id,
        actorUserId: input.actorUserId ?? null,
        metadata: {
          provider: input.provider,
          eventType: input.eventType,
          refundId: refund.id,
          transactionId: refund.transactionId,
          idempotencyKey: input.idempotencyKey,
          error: message,
        },
      });

      throw error;
    }
  }

  async reconcileProviderEventsForTransaction(
    transactionId: string,
    actorUserId?: string | null,
  ) {
    const refund = await this.prisma.refund.findUnique({
      where: { transactionId },
      select: {
        id: true,
        transactionId: true,
        provider: true,
        status: true,
        amount: true,
        currency: true,
        idempotencyKey: true,
        externalReference: true,
        failureReason: true,
        metadata: true,
        requestedAt: true,
        processedAt: true,
        refundedAt: true,
      },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found for transaction');
    }

    const events = await this.prisma.providerEvent.findMany({
      where: {
        objectType: ProviderEventObjectType.REFUND,
        OR: [{ transactionId }, { refundId: refund.id }],
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    if (events.length === 0) {
      return {
        transactionId,
        refundId: refund.id,
        currentRefundStatus: refund.status,
        reconciled: false,
        message: 'No provider events found for this refund',
      };
    }

    const target =
      events.find(
        (event) =>
          event.processingStatus === ProviderEventProcessingStatus.RECEIVED ||
          event.processingStatus === ProviderEventProcessingStatus.FAILED,
      ) ?? null;

    if (!target) {
      return {
        transactionId,
        refundId: refund.id,
        currentRefundStatus: refund.status,
        reconciled: false,
        latestProviderEventId: events[0].id,
        message: 'No unapplied provider event found',
      };
    }

    const applied = await this.applyProviderEventToRefund({
      refund,
      provider: refund.provider,
      eventType: target.eventType,
      idempotencyKey: target.idempotencyKey,
      occurredAt: target.occurredAt,
      externalReference: target.externalReference ?? refund.externalReference,
      payload:
        target.payload &&
        typeof target.payload === 'object' &&
        !Array.isArray(target.payload)
          ? (target.payload as Record<string, unknown>)
          : {},
      actorUserId: actorUserId ?? null,
    });

    const updatedEvent = await this.markProviderEventApplied(
      target.id,
      applied.processingStatus,
      applied.failureReason ?? null,
    );

    await this.adminActionAuditService?.recordSafe({
      action: 'REFUND_PROVIDER_EVENT_RECONCILED',
      targetType: 'PROVIDER_EVENT',
      targetId: updatedEvent.id,
      actorUserId: actorUserId ?? null,
      metadata: {
        transactionId,
        refundId: refund.id,
        appliedAction: applied.action,
        eventType: target.eventType,
        idempotencyKey: target.idempotencyKey,
      },
    });

    return {
      transactionId,
      refundId: refund.id,
      currentRefundStatus: (applied.refund as any)?.status ?? refund.status,
      reconciled: true,
      providerEventId: updatedEvent.id,
      appliedAction: applied.action,
    };
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
      actorUserId?: string | null;
    },
  ): Promise<Refund> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        currency: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (
      tx.status !== TransactionStatus.DISPUTED &&
      tx.status !== TransactionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot request refund: transaction status must be DISPUTED or CANCELLED',
      );
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Cannot request refund: paymentStatus is not SUCCESS',
      );
    }

    const balances = await this.ledger.getBalances(transactionId);
    const escrowBalance = balances.escrowBalance;

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
          currency: tx.currency,
          failureReason: null,
          metadata: {
            refreshedAt: new Date().toISOString(),
            reason: opts?.reason ?? null,
            referenceId: opts?.referenceId ?? null,
            escrowBalance,
            commissionBalance: balances.commissionBalance,
            reserveBalance: balances.reserveBalance,
            ...(opts?.metadata ?? {}),
          } as Prisma.InputJsonValue,
          idempotencyKey: opts?.idempotencyKey ?? existing.idempotencyKey,
          requestedAt: null,
          processedAt: null,
          refundedAt: null,
        },
      });

      const dispatched = await this.dispatchToProvider(refreshed);

      await this.adminActionAuditService?.recordSafe({
        action: 'REFUND_REQUESTED',
        targetType: 'REFUND',
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
          escrowBalance,
        },
      });

      return dispatched;
    }

    const refund = await this.prisma.refund.create({
      data: {
        transactionId,
        provider,
        status: RefundStatus.READY,
        amount,
        currency: tx.currency,
        idempotencyKey:
          opts?.idempotencyKey ?? `refund_request:${transactionId}`,
        metadata: {
          createdFrom: 'refund.request',
          reason: opts?.reason ?? null,
          referenceId: opts?.referenceId ?? null,
          escrowBalance,
          commissionBalance: balances.commissionBalance,
          reserveBalance: balances.reserveBalance,
          ...(opts?.metadata ?? {}),
        } as Prisma.InputJsonValue,
      },
    });

    const dispatched = await this.dispatchToProvider(refund);

    await this.adminActionAuditService?.recordSafe({
      action: 'REFUND_REQUESTED',
      targetType: 'REFUND',
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
        escrowBalance,
      },
    });

    return dispatched;
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

    if (refund.status !== RefundStatus.FAILED) {
      throw new BadRequestException('Only FAILED refunds can be retried');
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
            currency: true,
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.status === RefundStatus.REFUNDED) {
      throw new BadRequestException(
        'Cannot mark refunded: refund already REFUNDED',
      );
    }

    if (refund.status === RefundStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark refunded: refund is CANCELLED');
    }

    if (refund.status === RefundStatus.FAILED) {
      throw new BadRequestException(
        'Cannot mark refunded: refund is FAILED and must be retried first',
      );
    }

    if (
      refund.status !== RefundStatus.REQUESTED &&
      refund.status !== RefundStatus.PROCESSING &&
      refund.status !== RefundStatus.READY
    ) {
      throw new BadRequestException(
        'Only REQUESTED, PROCESSING or READY refunds can be marked REFUNDED',
      );
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

      const balances = await this.ledger.getBalances(refund.transactionId, dbTx);

      await dbTx.transaction.update({
        where: { id: refund.transactionId },
        data: {
          escrowAmount: balances.escrowBalance,
          paymentStatus:
            balances.escrowBalance === 0 &&
            refund.amount === refund.transaction.amount
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
        currency: refund.currency,
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

    if (refund.status === RefundStatus.FAILED) {
      throw new BadRequestException('Cannot mark failed: refund already FAILED');
    }

    if (refund.status === RefundStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark failed: refund is CANCELLED');
    }

    if (
      refund.status !== RefundStatus.REQUESTED &&
      refund.status !== RefundStatus.PROCESSING
    ) {
      throw new BadRequestException(
        'Only REQUESTED or PROCESSING refunds can be marked FAILED',
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