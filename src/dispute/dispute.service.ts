import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DisputeInitiatedBySide,
  DisputeOpeningSource,
  DisputeOutcome,
  DisputeReasonCode,
  DisputeStatus,
  DisputeTriggeredByRole,
  EvidenceLevel,
  PaymentStatus,
  Payout,
  PayoutProvider,
  Prisma,
  Refund,
  RefundProvider,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputeMatrixService } from './dispute-matrix.service';
import { GetDisputeRecommendationDto } from './dto/get-dispute-recommendation.dto';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto';
import { PayoutService } from '../payout/payout.service';
import { RefundService } from '../refund/refund.service';
import { AdminActionAuditService } from '../admin-action-audit/admin-action-audit.service';

@Injectable()
export class DisputeService {
  private readonly DELIVERY_WINDOW_HOURS = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly matrix: DisputeMatrixService,
    private readonly payoutService: PayoutService,
    private readonly refundService: RefundService,
    @Optional()
    private readonly adminActionAuditService?: AdminActionAuditService,
  ) {}

  private computeIsWithinDeliveryWindow(
    deliveredAt: Date | null,
    openedAt: Date,
  ): boolean {
    if (!deliveredAt) {
      return false;
    }

    return (
      openedAt.getTime() - deliveredAt.getTime() <=
      this.DELIVERY_WINDOW_HOURS * 3600 * 1000
    );
  }

  private inferInitiatedBySide(input: {
    senderId: string;
    travelerId: string;
    openedById: string;
    providedInitiatedBySide?: DisputeInitiatedBySide;
    openingSource: DisputeOpeningSource;
  }): DisputeInitiatedBySide {
    if (input.providedInitiatedBySide) {
      return input.providedInitiatedBySide;
    }

    if (
      input.openingSource ===
      DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER
    ) {
      return DisputeInitiatedBySide.TRAVELER;
    }

    if (
      input.openingSource === DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER
    ) {
      return DisputeInitiatedBySide.SENDER;
    }

    if (input.openedById === input.travelerId) {
      return DisputeInitiatedBySide.TRAVELER;
    }

    return DisputeInitiatedBySide.SENDER;
  }

  private inferTriggeredByRole(actorRole?: Role): DisputeTriggeredByRole {
    return actorRole === Role.ADMIN
      ? DisputeTriggeredByRole.ADMIN
      : DisputeTriggeredByRole.USER;
  }

  async create(data: {
    transactionId: string;
    openedById: string;
    reason: string;
    reasonCode?: DisputeReasonCode;
    openingSource?: DisputeOpeningSource;
    initiatedBySide?: DisputeInitiatedBySide;
    actorRole?: Role;
  }) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: data.transactionId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        senderId: true,
        travelerId: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Dispute can only be opened for a paid transaction',
      );
    }

    if (tx.status === TransactionStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot open a dispute for a CANCELLED transaction',
      );
    }

    const existingOpenDispute = await this.prisma.dispute.findFirst({
      where: {
        transactionId: data.transactionId,
        status: DisputeStatus.OPEN,
      },
    });

    if (existingOpenDispute) {
      return existingOpenDispute;
    }

    if (tx.status !== TransactionStatus.DISPUTED) {
      await this.prisma.transaction.update({
        where: { id: data.transactionId },
        data: { status: TransactionStatus.DISPUTED },
      });
    }

    const openingSource = data.openingSource ?? DisputeOpeningSource.MANUAL;

    const initiatedBySide = this.inferInitiatedBySide({
      senderId: tx.senderId,
      travelerId: tx.travelerId,
      openedById: data.openedById,
      providedInitiatedBySide: data.initiatedBySide,
      openingSource,
    });

    const triggeredByRole = this.inferTriggeredByRole(data.actorRole);

    const created = await this.prisma.dispute.create({
      data: {
        transactionId: data.transactionId,
        openedById: data.openedById,
        reason: data.reason,
        reasonCode: data.reasonCode ?? DisputeReasonCode.OTHER,
        openingSource,
        initiatedBySide,
        triggeredByRole,
        status: DisputeStatus.OPEN,
      },
    });

    await this.adminActionAuditService?.recordSafe({
      action: 'DISPUTE_CREATED',
      targetType: 'DISPUTE',
      targetId: created.id,
      actorUserId: data.openedById,
      metadata: {
        transactionId: data.transactionId,
        reasonCode: created.reasonCode,
        openingSource: created.openingSource,
        initiatedBySide: created.initiatedBySide,
        triggeredByRole: created.triggeredByRole,
        transactionStatusAtOpen: tx.status,
      },
    });

    return created;
  }

  async findAll(query?: ListDisputesQueryDto) {
    const where: Prisma.DisputeWhereInput = {
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.openingSource ? { openingSource: query.openingSource } : {}),
      ...(query?.initiatedBySide
        ? { initiatedBySide: query.initiatedBySide }
        : {}),
      ...(query?.triggeredByRole
        ? { triggeredByRole: query.triggeredByRole }
        : {}),
      ...(query?.transactionId ? { transactionId: query.transactionId } : {}),
    };

    return this.prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        resolution: true,
        transaction: {
          include: {
            payout: true,
            refund: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.dispute.findUniqueOrThrow({
      where: { id },
      include: {
        resolution: true,
        transaction: {
          include: {
            payout: true,
            refund: true,
          },
        },
      },
    });
  }

  async getRecommendation(
    disputeId: string,
    dto: GetDisputeRecommendationDto,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { transaction: true },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const tx = dispute.transaction;
    const isDelivered = tx.status === TransactionStatus.DELIVERED;

    const deliveredAtApprox = isDelivered
      ? tx.deliveryConfirmedAt ?? tx.updatedAt
      : null;
    const openedAt = dispute.createdAt;

    const isWithinDeliveryWindow = this.computeIsWithinDeliveryWindow(
      deliveredAtApprox,
      openedAt,
    );

    const evidenceLevel = dto.evidenceLevel ?? EvidenceLevel.STRONG;

    const rec = this.matrix.recommend({
      reasonCode: dispute.reasonCode,
      evidenceLevel,
      isDelivered,
      isWithinDeliveryWindow,
    });

    return {
      disputeId: dispute.id,
      transactionId: dispute.transactionId,
      input: {
        reasonCode: dispute.reasonCode,
        evidenceLevel,
        isDelivered,
        isWithinDeliveryWindow,
      },
      ...rec,
    };
  }

  async resolve(disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        transaction: {
          include: {
            payout: true,
            refund: true,
          },
        },
        resolution: true,
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== DisputeStatus.OPEN) {
      if (dispute.resolution) {
        return {
          resolution: dispute.resolution,
          payout: dispute.transaction.payout ?? null,
          refund: dispute.transaction.refund ?? null,
        };
      }
      throw new BadRequestException('Dispute is not OPEN');
    }

    const tx = dispute.transaction;

    const isDelivered = tx.status === TransactionStatus.DELIVERED;
    const deliveredAtApprox = isDelivered
      ? tx.deliveryConfirmedAt ?? tx.updatedAt
      : null;
    const openedAt = dispute.createdAt;

    const isWithinDeliveryWindow = this.computeIsWithinDeliveryWindow(
      deliveredAtApprox,
      openedAt,
    );

    const rec = this.matrix.recommend({
      reasonCode: dispute.reasonCode,
      evidenceLevel: dto.evidenceLevel ?? EvidenceLevel.NONE,
      isDelivered,
      isWithinDeliveryWindow,
    });

    const escrowBalance = await this.ledger.getEscrowBalance(tx.id);
    const total = escrowBalance;

    let refund = dto.refundAmount ?? 0;
    let release = dto.releaseAmount ?? 0;

    if (dto.outcome === DisputeOutcome.REFUND_SENDER) {
      refund = total;
      release = 0;
    } else if (dto.outcome === DisputeOutcome.RELEASE_TO_TRAVELER) {
      refund = 0;
      release = total;
    } else if (dto.outcome === DisputeOutcome.SPLIT) {
      if (dto.refundAmount == null && dto.releaseAmount == null) {
        refund = Math.floor(total / 2);
        release = total - refund;
      }
    } else if (dto.outcome === DisputeOutcome.REJECT) {
      refund = 0;
      release = 0;
    }

    if (refund < 0 || release < 0) {
      throw new BadRequestException('Amounts must be >= 0');
    }

    if (refund + release > total) {
      throw new BadRequestException(
        `refund+release exceeds escrow balance (${total})`,
      );
    }

    const resolutionKey = `dispute_resolve:${disputeId}`;

    const existing = await this.prisma.disputeResolution.findUnique({
      where: { idempotencyKey: resolutionKey },
    });

    if (existing) {
      return {
        resolution: existing,
        payout: await this.prisma.payout.findUnique({
          where: { transactionId: tx.id },
        }),
        refund: await this.prisma.refund.findUnique({
          where: { transactionId: tx.id },
        }),
      };
    }

    const dbResult = await this.prisma.$transaction(async (prismaTx) => {
      const resolution = await prismaTx.disputeResolution.create({
        data: {
          disputeId,
          transactionId: tx.id,
          outcome: dto.outcome,
          evidenceLevel: dto.evidenceLevel ?? EvidenceLevel.NONE,
          refundAmount: refund,
          releaseAmount: release,
          decidedById: dto.decidedById,
          notes: dto.notes,
          matrixVersion: rec.matrixVersion,
          recommendedOutcome: rec.recommendedOutcome,
          recommendationNotes: rec.recommendationNotes,
          idempotencyKey: resolutionKey,
        },
      });

      await prismaTx.dispute.update({
        where: { id: disputeId },
        data: { status: DisputeStatus.RESOLVED },
      });

      return { resolution };
    });

    let payout: Payout | null = null;
    let refundRecord: Refund | null = null;

    if (release > 0) {
      payout = await this.payoutService.requestPayoutForTransaction(
        tx.id,
        PayoutProvider.MANUAL,
      );
    }

    if (refund > 0) {
      refundRecord = await this.refundService.requestRefundForTransaction(
        tx.id,
        refund,
        RefundProvider.MANUAL,
      );
    }

    await this.adminActionAuditService?.recordSafe({
      action: 'DISPUTE_RESOLVED',
      targetType: 'DISPUTE',
      targetId: disputeId,
      actorUserId: dto.decidedById,
      metadata: {
        transactionId: tx.id,
        outcome: dto.outcome,
        evidenceLevel: dto.evidenceLevel ?? null,
        refundAmount: refund,
        releaseAmount: release,
        recommendedOutcome: rec.recommendedOutcome ?? null,
        matrixVersion: rec.matrixVersion,
        payoutId: payout?.id ?? null,
        refundId: refundRecord?.id ?? null,
      },
    });

    return {
      resolution: dbResult.resolution,
      payout,
      refund: refundRecord,
    };
  }
}