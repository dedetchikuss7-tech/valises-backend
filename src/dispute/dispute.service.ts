import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DisputeOutcome,
  DisputeReasonCode,
  DisputeStatus,
  EvidenceLevel,
  LedgerEntryType,
  TransactionStatus,
} from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputeMatrixService } from './dispute-matrix.service';
import { GetDisputeRecommendationDto } from './dto/get-dispute-recommendation.dto';

@Injectable()
export class DisputeService {
  // fenêtre post-delivery : 24h
  private readonly DELIVERY_WINDOW_HOURS = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly matrix: DisputeMatrixService,
  ) {}

  async create(data: {
    transactionId: string;
    openedById: string;
    reason: string;
    reasonCode?: DisputeReasonCode;
  }) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: data.transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');

    // Mark transaction as disputed
    await this.prisma.transaction.update({
      where: { id: data.transactionId },
      data: { status: TransactionStatus.DISPUTED },
    });

    return this.prisma.dispute.create({
      data: {
        transactionId: data.transactionId,
        openedById: data.openedById,
        reason: data.reason,
        reasonCode: data.reasonCode ?? DisputeReasonCode.OTHER,
        status: DisputeStatus.OPEN,
      },
    });
  }

  async findAll() {
    return this.prisma.dispute.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    return this.prisma.dispute.findUniqueOrThrow({
      where: { id },
      include: { resolution: true },
    });
  }

  /**
   * GET recommendation (matrix)
   * - evidenceLevel peut être fourni en query param; sinon on prend STRONG par défaut.
   */
  async getRecommendation(disputeId: string, dto: GetDisputeRecommendationDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { transaction: true },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const tx = dispute.transaction;
    const isDelivered = tx.status === TransactionStatus.DELIVERED;

    // Approximation: si DELIVERED, tx.updatedAt ≈ moment de delivery
    const deliveredAtApprox = isDelivered ? tx.updatedAt : null;
    const openedAt = dispute.createdAt;

    const isWithinDeliveryWindow =
      isDelivered && deliveredAtApprox
        ? openedAt.getTime() - deliveredAtApprox.getTime() <= this.DELIVERY_WINDOW_HOURS * 3600 * 1000
        : false;

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
      include: { transaction: true, resolution: true },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    if (dispute.status !== DisputeStatus.OPEN) {
      if (dispute.resolution) return dispute.resolution;
      throw new BadRequestException('Dispute is not OPEN');
    }

    const tx = dispute.transaction;

    // Funds available in escrow at time of resolution
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
      throw new BadRequestException(`refund+release exceeds escrow balance (${total})`);
    }

    const resolutionKey = `dispute_resolve:${disputeId}`;

    // idempotency: if already resolved with this key, return it
    const existing = await this.prisma.disputeResolution.findUnique({
      where: { idempotencyKey: resolutionKey },
    });
    if (existing) return existing;

    // --- Matrix recommendation (stored for audit) ---
    const isDelivered = tx.status === TransactionStatus.DELIVERED;
    const deliveredAtApprox = isDelivered ? tx.updatedAt : null;
    const openedAt = dispute.createdAt;

    const isWithinDeliveryWindow =
      isDelivered && deliveredAtApprox
        ? openedAt.getTime() - deliveredAtApprox.getTime() <= this.DELIVERY_WINDOW_HOURS * 3600 * 1000
        : false;

    const rec = this.matrix.recommend({
      reasonCode: dispute.reasonCode,
      evidenceLevel: dto.evidenceLevel ?? EvidenceLevel.NONE,
      isDelivered,
      isWithinDeliveryWindow,
    });

    const resolution = await this.prisma.disputeResolution.create({
      data: {
        disputeId,
        transactionId: tx.id,
        decidedById: dto.decidedById,
        outcome: dto.outcome,
        evidenceLevel: dto.evidenceLevel,
        refundAmount: refund,
        releaseAmount: release,
        notes: dto.notes,
        idempotencyKey: resolutionKey,

        // matrix audit fields (already in schema)
        matrixVersion: rec.matrixVersion,
        recommendedOutcome: rec.recommendedOutcome,
        recommendationNotes: rec.recommendationNotes,
      },
    });

    // Ledger impacts (idempotent entries)
    if (refund > 0) {
      await this.ledger.addEntryIdempotent({
        transactionId: tx.id,
        type: LedgerEntryType.ESCROW_DEBIT_REFUND,
        amount: refund,
        note: `Dispute refund to sender (dispute ${disputeId})`,
        idempotencyKey: `${resolutionKey}:refund`,
      });
    }

    if (release > 0) {
      await this.ledger.addEntryIdempotent({
        transactionId: tx.id,
        type: LedgerEntryType.ESCROW_DEBIT_RELEASE,
        amount: release,
        note: `Dispute release to traveler (dispute ${disputeId})`,
        idempotencyKey: `${resolutionKey}:release`,
      });
    }

    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: DisputeStatus.RESOLVED },
    });

    return resolution;
  }
}