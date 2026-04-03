import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DisputeCaseNote,
  DisputeEvidenceItem,
  DisputeEvidenceItemStatus,
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
import { CreateDisputeCaseNoteDto } from './dto/create-dispute-case-note.dto';
import { UpdateDisputeAdminDossierDto } from './dto/update-dispute-admin-dossier.dto';
import { CreateDisputeEvidenceItemDto } from './dto/create-dispute-evidence-item.dto';
import { ReviewDisputeEvidenceItemDto } from './dto/review-dispute-evidence-item.dto';

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

  private buildEvidenceSummary(
    evidenceItems: Array<{
      status: DisputeEvidenceItemStatus;
      reviewedAt: Date | null;
    }>,
  ) {
    const pendingEvidenceCount = evidenceItems.filter(
      (item) => item.status === DisputeEvidenceItemStatus.PENDING,
    ).length;

    const acceptedEvidenceCount = evidenceItems.filter(
      (item) => item.status === DisputeEvidenceItemStatus.ACCEPTED,
    ).length;

    const rejectedEvidenceCount = evidenceItems.filter(
      (item) => item.status === DisputeEvidenceItemStatus.REJECTED,
    ).length;

    const reviewedDates = evidenceItems
      .map((item) => item.reviewedAt)
      .filter((date): date is Date => date instanceof Date);

    const lastEvidenceReviewedAt =
      reviewedDates.length > 0
        ? new Date(
            Math.max(...reviewedDates.map((date) => date.getTime())),
          ).toISOString()
        : null;

    return {
      totalEvidenceCount: evidenceItems.length,
      pendingEvidenceCount,
      acceptedEvidenceCount,
      rejectedEvidenceCount,
      hasPendingEvidenceReview: pendingEvidenceCount > 0,
      lastEvidenceReviewedAt,
    };
  }

  private buildRequiresAdminAttention(input: {
    disputeStatus: DisputeStatus;
    hasPendingEvidenceReview: boolean;
    evidenceStatus?: string | null;
    adminAssessment?: string | null;
    resolutionExists: boolean;
    refundStatus?: string | null;
    payoutStatus?: string | null;
  }): boolean {
    if (input.disputeStatus !== DisputeStatus.OPEN) {
      return false;
    }

    if (input.hasPendingEvidenceReview) {
      return true;
    }

    if (!input.adminAssessment) {
      return true;
    }

    if (input.evidenceStatus === 'IN_REVIEW') {
      return true;
    }

    if (
      input.resolutionExists &&
      (input.refundStatus === 'REQUESTED' || input.payoutStatus === 'REQUESTED')
    ) {
      return true;
    }

    return false;
  }

  private buildAdminSummary(dispute: any) {
    const evidenceSummary = this.buildEvidenceSummary(dispute.evidenceItems ?? []);
    const noteCount =
      dispute._count?.caseNotes ?? dispute.caseNotes?.length ?? 0;

    const refundStatus = dispute.transaction?.refund?.status ?? null;
    const payoutStatus = dispute.transaction?.payout?.status ?? null;
    const resolutionExists = !!dispute.resolution;

    const requiresAdminAttention = this.buildRequiresAdminAttention({
      disputeStatus: dispute.status,
      hasPendingEvidenceReview: evidenceSummary.hasPendingEvidenceReview,
      evidenceStatus: dispute.evidenceStatus ?? null,
      adminAssessment: dispute.adminAssessment ?? null,
      resolutionExists,
      refundStatus,
      payoutStatus,
    });

    return {
      noteCount,
      ...evidenceSummary,
      resolutionExists,
      refundStatus,
      payoutStatus,
      requiresAdminAttention,
    };
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
      ...(query?.evidenceStatus ? { evidenceStatus: query.evidenceStatus } : {}),
      ...(query?.reasonCode ? { reasonCode: query.reasonCode } : {}),
      ...(query?.transactionId ? { transactionId: query.transactionId } : {}),
      ...(query?.openedById ? { openedById: query.openedById } : {}),
    };

    const disputes = await this.prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        resolution: true,
        _count: {
          select: {
            caseNotes: true,
          },
        },
        evidenceItems: {
          select: {
            status: true,
            reviewedAt: true,
          },
        },
        transaction: {
          include: {
            payout: true,
            refund: true,
          },
        },
      },
    });

    const enriched = disputes.map((dispute) => ({
      ...dispute,
      adminSummary: this.buildAdminSummary(dispute),
    }));

    if (query?.hasPendingEvidenceReview === undefined) {
      return enriched;
    }

    const expected = query.hasPendingEvidenceReview === 'true';

    return enriched.filter(
      (item) => item.adminSummary.hasPendingEvidenceReview === expected,
    );
  }

  async findOne(id: string) {
    const dispute = await this.prisma.dispute.findUniqueOrThrow({
      where: { id },
      include: {
        resolution: true,
        caseNotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            authorAdmin: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
        },
        evidenceItems: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewedByAdmin: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
        },
        transaction: {
          include: {
            payout: true,
            refund: true,
          },
        },
      },
    });

    return {
      ...dispute,
      adminSummary: this.buildAdminSummary(dispute),
    };
  }

  async addCaseNote(
    disputeId: string,
    authorAdminId: string,
    dto: CreateDisputeCaseNoteDto,
  ): Promise<DisputeCaseNote> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true, transactionId: true },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const note = await this.prisma.disputeCaseNote.create({
      data: {
        disputeId,
        authorAdminId,
        note: dto.note,
      },
    });

    await this.adminActionAuditService?.recordSafe({
      action: 'DISPUTE_CASE_NOTE_ADDED',
      targetType: 'DISPUTE',
      targetId: disputeId,
      actorUserId: authorAdminId,
      metadata: {
        transactionId: dispute.transactionId,
        disputeCaseNoteId: note.id,
      },
    });

    return note;
  }

  async updateAdminDossier(
    disputeId: string,
    adminUserId: string,
    dto: UpdateDisputeAdminDossierDto,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true, transactionId: true },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        ...(dto.customerStatement !== undefined
          ? { customerStatement: dto.customerStatement }
          : {}),
        ...(dto.travelerStatement !== undefined
          ? { travelerStatement: dto.travelerStatement }
          : {}),
        ...(dto.evidenceSummary !== undefined
          ? { evidenceSummary: dto.evidenceSummary }
          : {}),
        ...(dto.adminAssessment !== undefined
          ? { adminAssessment: dto.adminAssessment }
          : {}),
        ...(dto.evidenceStatus !== undefined
          ? { evidenceStatus: dto.evidenceStatus }
          : {}),
      },
    });

    await this.adminActionAuditService?.recordSafe({
      action: 'DISPUTE_ADMIN_DOSSIER_UPDATED',
      targetType: 'DISPUTE',
      targetId: disputeId,
      actorUserId: adminUserId,
      metadata: {
        transactionId: dispute.transactionId,
        updatedFields: {
          customerStatement: dto.customerStatement !== undefined,
          travelerStatement: dto.travelerStatement !== undefined,
          evidenceSummary: dto.evidenceSummary !== undefined,
          adminAssessment: dto.adminAssessment !== undefined,
          evidenceStatus: dto.evidenceStatus ?? null,
        },
      },
    });

    return updated;
  }

  async addEvidenceItem(
    disputeId: string,
    adminUserId: string,
    dto: CreateDisputeEvidenceItemDto,
  ): Promise<DisputeEvidenceItem> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true, transactionId: true },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const item = await this.prisma.disputeEvidenceItem.create({
      data: {
        disputeId,
        kind: dto.kind,
        label: dto.label,
        storageKey: dto.storageKey,
        fileName: dto.fileName ?? null,
        mimeType: dto.mimeType ?? null,
        sizeBytes: dto.sizeBytes ?? null,
        status: DisputeEvidenceItemStatus.PENDING,
      },
    });

    await this.adminActionAuditService?.recordSafe({
      action: 'DISPUTE_EVIDENCE_ITEM_ADDED',
      targetType: 'DISPUTE',
      targetId: disputeId,
      actorUserId: adminUserId,
      metadata: {
        transactionId: dispute.transactionId,
        disputeEvidenceItemId: item.id,
        kind: item.kind,
        status: item.status,
      },
    });

    return item;
  }

  async reviewEvidenceItem(
    disputeId: string,
    evidenceItemId: string,
    adminUserId: string,
    dto: ReviewDisputeEvidenceItemDto,
  ): Promise<DisputeEvidenceItem> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true, transactionId: true },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const item = await this.prisma.disputeEvidenceItem.findUnique({
      where: { id: evidenceItemId },
      select: { id: true, disputeId: true },
    });

    if (!item || item.disputeId !== disputeId) {
      throw new NotFoundException('Dispute evidence item not found');
    }

    if (
      dto.status === DisputeEvidenceItemStatus.REJECTED &&
      !dto.rejectionReason
    ) {
      throw new BadRequestException(
        'rejectionReason is required when status is REJECTED',
      );
    }

    if (
      dto.status === DisputeEvidenceItemStatus.ACCEPTED &&
      dto.rejectionReason
    ) {
      throw new BadRequestException(
        'rejectionReason must be empty when status is ACCEPTED',
      );
    }

    const reviewed = await this.prisma.disputeEvidenceItem.update({
      where: { id: evidenceItemId },
      data: {
        status: dto.status,
        reviewedByAdminId: adminUserId,
        reviewedAt: new Date(),
        rejectionReason:
          dto.status === DisputeEvidenceItemStatus.REJECTED
            ? dto.rejectionReason ?? null
            : null,
      },
    });

    await this.adminActionAuditService?.recordSafe({
      action: 'DISPUTE_EVIDENCE_ITEM_REVIEWED',
      targetType: 'DISPUTE',
      targetId: disputeId,
      actorUserId: adminUserId,
      metadata: {
        transactionId: dispute.transactionId,
        disputeEvidenceItemId: evidenceItemId,
        status: dto.status,
        rejectionReason:
          dto.status === DisputeEvidenceItemStatus.REJECTED
            ? dto.rejectionReason ?? null
            : null,
      },
    });

    return reviewed;
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