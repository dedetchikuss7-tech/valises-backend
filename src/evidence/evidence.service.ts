import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminTimelineObjectType,
  AdminTimelineSeverity,
  EvidenceAttachment,
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentVisibility,
  Prisma,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminActionAuditService } from '../admin-action-audit/admin-action-audit.service';
import { AdminTimelineService } from '../admin-timeline/admin-timeline.service';
import { CreateEvidenceAttachmentDto } from './dto/create-evidence-attachment.dto';
import {
  EvidenceAttachmentSortBy,
  ListEvidenceAttachmentsQueryDto,
  SortOrder,
} from './dto/list-evidence-attachments-query.dto';
import { ReviewEvidenceAttachmentDto } from './dto/review-evidence-attachment.dto';
import { EvidenceAttachmentResponseDto } from './dto/evidence-attachment-response.dto';
import { EvidenceAdminSummaryResponseDto } from './dto/evidence-admin-summary-response.dto';
import { ListEvidenceAdminReviewQueueQueryDto } from './dto/list-evidence-admin-review-queue-query.dto';
import {
  EvidenceRecommendedAction,
  EvidenceReviewPriority,
  EvidenceReviewReason,
  EvidenceStorageCompletenessStatus,
} from './dto/evidence-admin-operational-signals.dto';

const EVIDENCE_REVIEW_OLD_MINUTES = 60 * 12;
const EVIDENCE_REVIEW_OVERDUE_MINUTES = 60 * 24;
const EVIDENCE_REVIEW_CRITICAL_MINUTES = 60 * 48;

type EvidenceAdminReviewQueueItem = EvidenceAttachmentResponseDto & {
  reviewAgeMinutes: number;
  isReviewOverdue: boolean;
  reviewPriority: EvidenceReviewPriority;
  reviewReasons: EvidenceReviewReason[];
  recommendedAction: EvidenceRecommendedAction;
  storageCompletenessStatus: EvidenceStorageCompletenessStatus;
};

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminActionAuditService: AdminActionAuditService,
    private readonly adminTimelineService: AdminTimelineService,
  ) {}

  async create(
    actorUserId: string,
    actorRole: Role,
    dto: CreateEvidenceAttachmentDto,
  ): Promise<EvidenceAttachmentResponseDto> {
    await this.assertCanAccessTarget({
      actorUserId,
      actorRole,
      targetType: dto.targetType,
      targetId: dto.targetId,
      action: 'create',
    });

    const storageFields = this.normalizeStorageFields(dto);

    const item = await this.prisma.evidenceAttachment.create({
      data: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        attachmentType: dto.attachmentType,
        visibility: dto.visibility,
        uploadedById: actorUserId,
        label: this.normalizeRequired(dto.label, 'label'),
        fileUrl: storageFields.fileUrl,
        provider: storageFields.provider,
        providerUploadId: storageFields.providerUploadId,
        storageKey: storageFields.storageKey,
        objectUrl: storageFields.objectUrl,
        publicUrl: storageFields.publicUrl,
        fileName: storageFields.fileName,
        mimeType: storageFields.mimeType,
        sizeBytes: dto.sizeBytes ?? null,
        metadata: (dto.metadata ?? null) as Prisma.InputJsonValue,
      },
    });

    return this.toResponse(item);
  }

  async list(
    actorUserId: string,
    actorRole: Role,
    query: ListEvidenceAttachmentsQueryDto,
  ) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    if (query.targetType && query.targetId) {
      await this.assertCanAccessTarget({
        actorUserId,
        actorRole,
        targetType: query.targetType,
        targetId: query.targetId,
        action: 'read',
      });
    }

    const where: Prisma.EvidenceAttachmentWhereInput = {
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.attachmentType ? { attachmentType: query.attachmentType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(actorRole === Role.ADMIN && query.uploadedById
        ? { uploadedById: query.uploadedById }
        : {}),
      ...(actorRole !== Role.ADMIN && !(query.targetType && query.targetId)
        ? { uploadedById: actorUserId }
        : {}),
      ...(query.q
        ? {
            OR: [
              { label: { contains: query.q, mode: 'insensitive' } },
              { targetId: { contains: query.q, mode: 'insensitive' } },
              { fileName: { contains: query.q, mode: 'insensitive' } },
              { mimeType: { contains: query.q, mode: 'insensitive' } },
              { fileUrl: { contains: query.q, mode: 'insensitive' } },
              { storageKey: { contains: query.q, mode: 'insensitive' } },
              { objectUrl: { contains: query.q, mode: 'insensitive' } },
              { providerUploadId: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.evidenceAttachment.findMany({
        where,
        orderBy: this.toOrderBy(query.sortBy, query.sortOrder),
        take: limit,
        skip: offset,
      }),
      this.prisma.evidenceAttachment.count({ where }),
    ]);

    const visibleItems =
      actorRole === Role.ADMIN
        ? items
        : items.filter((item) => this.canReadAttachmentSync(actorUserId, item));

    return {
      items: visibleItems.map((item) => this.toResponse(item)),
      total: actorRole === Role.ADMIN ? total : visibleItems.length,
      limit,
      offset,
      hasMore:
        actorRole === Role.ADMIN
          ? offset + limit < total
          : offset + limit < visibleItems.length,
      filters: {
        targetType: query.targetType ?? null,
        targetId: query.targetId ?? null,
        attachmentType: query.attachmentType ?? null,
        status: query.status ?? null,
        visibility: query.visibility ?? null,
        uploadedById:
          actorRole === Role.ADMIN ? query.uploadedById ?? null : actorUserId,
        q: query.q ?? null,
      },
    };
  }

  async getOne(
    actorUserId: string,
    actorRole: Role,
    id: string,
  ): Promise<EvidenceAttachmentResponseDto> {
    const item = await this.prisma.evidenceAttachment.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Evidence attachment not found');
    }

    await this.assertCanReadAttachment(actorUserId, actorRole, item);

    return this.toResponse(item);
  }

  async review(
    actorUserId: string,
    actorRole: Role,
    id: string,
    dto: ReviewEvidenceAttachmentDto,
  ): Promise<EvidenceAttachmentResponseDto> {
    if (actorRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only an admin can review evidence attachments',
      );
    }

    if (dto.status === EvidenceAttachmentStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Admin review cannot reset evidence attachment to PENDING_REVIEW',
      );
    }

    const existing = await this.prisma.evidenceAttachment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Evidence attachment not found');
    }

    const item = await this.prisma.evidenceAttachment.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedByAdminId: actorUserId,
        reviewedAt: new Date(),
        reviewNotes: this.normalizeOptional(dto.reviewNotes),
        rejectionReason:
          dto.status === EvidenceAttachmentStatus.REJECTED
            ? this.normalizeOptional(dto.rejectionReason)
            : null,
      },
    });

    await this.recordEvidenceReviewTrace({
      actorUserId,
      previous: existing,
      reviewed: item,
      reviewNotes: dto.reviewNotes,
      rejectionReason: dto.rejectionReason,
    });

    return this.toResponse(item);
  }

  async getAdminSummary(
    actorRole: Role,
  ): Promise<EvidenceAdminSummaryResponseDto> {
    this.assertAdmin(actorRole);

    const [
      totalAttachments,
      pendingReviewCount,
      acceptedCount,
      rejectedCount,
      adminOnlyCount,
      ownerOnlyCount,
      partiesVisibleCount,
      packageEvidenceCount,
      transactionEvidenceCount,
      deliveryEvidenceCount,
      disputeEvidenceCount,
      payoutEvidenceCount,
      refundEvidenceCount,
      kycEvidenceCount,
      adminCaseEvidenceCount,
      otherEvidenceCount,
    ] = await Promise.all([
      this.prisma.evidenceAttachment.count(),
      this.prisma.evidenceAttachment.count({
        where: { status: EvidenceAttachmentStatus.PENDING_REVIEW },
      }),
      this.prisma.evidenceAttachment.count({
        where: { status: EvidenceAttachmentStatus.ACCEPTED },
      }),
      this.prisma.evidenceAttachment.count({
        where: { status: EvidenceAttachmentStatus.REJECTED },
      }),
      this.prisma.evidenceAttachment.count({
        where: { visibility: EvidenceAttachmentVisibility.ADMIN_ONLY },
      }),
      this.prisma.evidenceAttachment.count({
        where: { visibility: EvidenceAttachmentVisibility.OWNER_ONLY },
      }),
      this.prisma.evidenceAttachment.count({
        where: { visibility: EvidenceAttachmentVisibility.PARTIES },
      }),
      this.countByTargetType(EvidenceAttachmentObjectType.PACKAGE),
      this.countByTargetType(EvidenceAttachmentObjectType.TRANSACTION),
      this.countByTargetType(EvidenceAttachmentObjectType.DELIVERY),
      this.countByTargetType(EvidenceAttachmentObjectType.DISPUTE),
      this.countByTargetType(EvidenceAttachmentObjectType.PAYOUT),
      this.countByTargetType(EvidenceAttachmentObjectType.REFUND),
      this.countByTargetType(EvidenceAttachmentObjectType.KYC),
      this.countByTargetType(EvidenceAttachmentObjectType.ADMIN_CASE),
      this.countByTargetType(EvidenceAttachmentObjectType.OTHER),
    ]);

    return {
      generatedAt: new Date(),
      totalAttachments,
      pendingReviewCount,
      acceptedCount,
      rejectedCount,
      adminOnlyCount,
      ownerOnlyCount,
      partiesVisibleCount,
      packageEvidenceCount,
      transactionEvidenceCount,
      deliveryEvidenceCount,
      disputeEvidenceCount,
      payoutEvidenceCount,
      refundEvidenceCount,
      kycEvidenceCount,
      adminCaseEvidenceCount,
      otherEvidenceCount,
    };
  }

  async listAdminReviewQueue(
    actorRole: Role,
    query: ListEvidenceAdminReviewQueueQueryDto,
  ) {
    this.assertAdmin(actorRole);

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const status = query.status ?? EvidenceAttachmentStatus.PENDING_REVIEW;

    const where: Prisma.EvidenceAttachmentWhereInput = {
      status,
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.attachmentType ? { attachmentType: query.attachmentType } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.uploadedById ? { uploadedById: query.uploadedById } : {}),
      ...(query.q
        ? {
            OR: [
              { label: { contains: query.q, mode: 'insensitive' } },
              { targetId: { contains: query.q, mode: 'insensitive' } },
              { fileName: { contains: query.q, mode: 'insensitive' } },
              { mimeType: { contains: query.q, mode: 'insensitive' } },
              { fileUrl: { contains: query.q, mode: 'insensitive' } },
              { storageKey: { contains: query.q, mode: 'insensitive' } },
              { objectUrl: { contains: query.q, mode: 'insensitive' } },
              { providerUploadId: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.evidenceAttachment.findMany({
        where,
        orderBy: this.toOrderBy(query.sortBy, query.sortOrder),
        take: limit,
        skip: offset,
      }),
      this.prisma.evidenceAttachment.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toAdminReviewQueueItem(item)),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      filters: {
        status,
        targetType: query.targetType ?? null,
        targetId: query.targetId ?? null,
        attachmentType: query.attachmentType ?? null,
        visibility: query.visibility ?? null,
        uploadedById: query.uploadedById ?? null,
        q: query.q ?? null,
      },
    };
  }

  private async assertCanReadAttachment(
    actorUserId: string,
    actorRole: Role,
    item: EvidenceAttachment,
  ): Promise<void> {
    if (actorRole === Role.ADMIN) {
      return;
    }

    if (item.uploadedById === actorUserId) {
      return;
    }

    if (item.visibility !== EvidenceAttachmentVisibility.PARTIES) {
      throw new ForbiddenException('You cannot access this evidence attachment');
    }

    await this.assertCanAccessTarget({
      actorUserId,
      actorRole,
      targetType: item.targetType,
      targetId: item.targetId,
      action: 'read',
    });
  }

  private canReadAttachmentSync(
    actorUserId: string,
    item: EvidenceAttachment,
  ): boolean {
    if (item.uploadedById === actorUserId) {
      return true;
    }

    return item.visibility === EvidenceAttachmentVisibility.PARTIES;
  }

  private async assertCanAccessTarget(input: {
    actorUserId: string;
    actorRole: Role;
    targetType: EvidenceAttachmentObjectType;
    targetId: string;
    action: 'create' | 'read';
  }): Promise<void> {
    if (!input.targetId?.trim()) {
      throw new BadRequestException('targetId is required');
    }

    if (input.actorRole === Role.ADMIN) {
      await this.assertTargetExists(input.targetType, input.targetId);
      return;
    }

    switch (input.targetType) {
      case EvidenceAttachmentObjectType.PACKAGE:
        await this.assertCanAccessPackageTarget(
          input.actorUserId,
          input.targetId,
        );
        return;

      case EvidenceAttachmentObjectType.TRANSACTION:
      case EvidenceAttachmentObjectType.DELIVERY:
        await this.assertCanAccessTransactionTarget(
          input.actorUserId,
          input.targetId,
        );
        return;

      case EvidenceAttachmentObjectType.DISPUTE:
        await this.assertCanAccessDisputeTarget(
          input.actorUserId,
          input.targetId,
        );
        return;

      case EvidenceAttachmentObjectType.PAYOUT:
        await this.assertCanAccessPayoutTarget(
          input.actorUserId,
          input.targetId,
        );
        return;

      case EvidenceAttachmentObjectType.REFUND:
        await this.assertCanAccessRefundTarget(
          input.actorUserId,
          input.targetId,
        );
        return;

      case EvidenceAttachmentObjectType.KYC:
        await this.assertCanAccessKycTarget(input.actorUserId, input.targetId);
        return;

      case EvidenceAttachmentObjectType.ADMIN_CASE:
      case EvidenceAttachmentObjectType.OTHER:
      default:
        throw new ForbiddenException(
          'Only an admin can attach evidence to this target type',
        );
    }
  }

  private async assertTargetExists(
    targetType: EvidenceAttachmentObjectType,
    targetId: string,
  ): Promise<void> {
    switch (targetType) {
      case EvidenceAttachmentObjectType.PACKAGE: {
        const item = await this.prisma.package.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) {
          throw new NotFoundException('Target package not found');
        }

        return;
      }

      case EvidenceAttachmentObjectType.TRANSACTION:
      case EvidenceAttachmentObjectType.DELIVERY: {
        const item = await this.prisma.transaction.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) {
          throw new NotFoundException('Target transaction not found');
        }

        return;
      }

      case EvidenceAttachmentObjectType.DISPUTE: {
        const item = await this.prisma.dispute.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) {
          throw new NotFoundException('Target dispute not found');
        }

        return;
      }

      case EvidenceAttachmentObjectType.PAYOUT: {
        const item = await this.prisma.payout.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) {
          throw new NotFoundException('Target payout not found');
        }

        return;
      }

      case EvidenceAttachmentObjectType.REFUND: {
        const item = await this.prisma.refund.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) {
          throw new NotFoundException('Target refund not found');
        }

        return;
      }

      case EvidenceAttachmentObjectType.KYC: {
        const item = await this.prisma.kycVerification.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) {
          throw new NotFoundException('Target KYC verification not found');
        }

        return;
      }

      case EvidenceAttachmentObjectType.ADMIN_CASE:
      case EvidenceAttachmentObjectType.OTHER:
      default:
        return;
    }
  }

  private async assertCanAccessPackageTarget(
    actorUserId: string,
    packageId: string,
  ): Promise<void> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        senderId: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException('Target package not found');
    }

    if (pkg.senderId === actorUserId) {
      return;
    }

    const transaction = await this.prisma.transaction.findFirst({
      where: {
        packageId,
        NOT: { status: TransactionStatus.CANCELLED },
      },
      select: {
        senderId: true,
        travelerId: true,
      },
    });

    if (
      transaction?.senderId === actorUserId ||
      transaction?.travelerId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException('You cannot attach evidence to this package');
  }

  private async assertCanAccessTransactionTarget(
    actorUserId: string,
    transactionId: string,
  ): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        senderId: true,
        travelerId: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Target transaction not found');
    }

    if (
      transaction.senderId === actorUserId ||
      transaction.travelerId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException(
      'You cannot attach evidence to this transaction',
    );
  }

  private async assertCanAccessDisputeTarget(
    actorUserId: string,
    disputeId: string,
  ): Promise<void> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: {
        id: true,
        openedById: true,
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Target dispute not found');
    }

    if (
      dispute.openedById === actorUserId ||
      dispute.transaction.senderId === actorUserId ||
      dispute.transaction.travelerId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException('You cannot attach evidence to this dispute');
  }

  private async assertCanAccessPayoutTarget(
    actorUserId: string,
    payoutId: string,
  ): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      select: {
        id: true,
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    if (!payout) {
      throw new NotFoundException('Target payout not found');
    }

    if (
      payout.transaction.senderId === actorUserId ||
      payout.transaction.travelerId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException('You cannot attach evidence to this payout');
  }

  private async assertCanAccessRefundTarget(
    actorUserId: string,
    refundId: string,
  ): Promise<void> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException('Target refund not found');
    }

    if (
      refund.transaction.senderId === actorUserId ||
      refund.transaction.travelerId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException('You cannot attach evidence to this refund');
  }

  private async assertCanAccessKycTarget(
    actorUserId: string,
    kycVerificationId: string,
  ): Promise<void> {
    const verification = await this.prisma.kycVerification.findUnique({
      where: { id: kycVerificationId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Target KYC verification not found');
    }

    if (verification.userId === actorUserId) {
      return;
    }

    throw new ForbiddenException('You cannot attach evidence to this KYC target');
  }

  private countByTargetType(targetType: EvidenceAttachmentObjectType) {
    return this.prisma.evidenceAttachment.count({
      where: { targetType },
    });
  }

  private assertAdmin(actorRole: Role): void {
    if (actorRole !== Role.ADMIN) {
      throw new ForbiddenException('Only an admin can access this evidence view');
    }
  }

  private async recordEvidenceReviewTrace(input: {
    actorUserId: string;
    previous: EvidenceAttachment;
    reviewed: EvidenceAttachment;
    reviewNotes?: string | null;
    rejectionReason?: string | null;
  }): Promise<void> {
    const action =
      input.reviewed.status === EvidenceAttachmentStatus.ACCEPTED
        ? 'EVIDENCE_ACCEPTED'
        : 'EVIDENCE_REJECTED';

    const title =
      input.reviewed.status === EvidenceAttachmentStatus.ACCEPTED
        ? 'Evidence attachment accepted'
        : 'Evidence attachment rejected';

    const message =
      input.reviewed.status === EvidenceAttachmentStatus.ACCEPTED
        ? `Evidence attachment ${input.reviewed.id} was accepted by admin.`
        : `Evidence attachment ${input.reviewed.id} was rejected by admin.`;

    const metadata = {
      evidenceId: input.reviewed.id,
      targetType: input.reviewed.targetType,
      targetId: input.reviewed.targetId,
      attachmentType: input.reviewed.attachmentType,
      visibility: input.reviewed.visibility,
      uploadedById: input.reviewed.uploadedById,
      provider: input.reviewed.provider,
      providerUploadId: input.reviewed.providerUploadId,
      storageKey: input.reviewed.storageKey,
      previousStatus: input.previous.status,
      newStatus: input.reviewed.status,
      reviewedByAdminId: input.actorUserId,
      reviewNotes: this.normalizeOptional(input.reviewNotes),
      rejectionReason:
        input.reviewed.status === EvidenceAttachmentStatus.REJECTED
          ? this.normalizeOptional(input.rejectionReason)
          : null,
    };

    await Promise.all([
      this.adminActionAuditService.recordSafe({
        action,
        targetType: 'EVIDENCE_ATTACHMENT',
        targetId: input.reviewed.id,
        actorUserId: input.actorUserId,
        metadata,
      }),
      this.adminTimelineService.recordSafe({
        objectType: this.toTimelineObjectType(input.reviewed.targetType),
        objectId: this.toTimelineObjectId(input.reviewed),
        eventType: action,
        title,
        message,
        actorUserId: input.actorUserId,
        severity:
          input.reviewed.status === EvidenceAttachmentStatus.REJECTED
            ? AdminTimelineSeverity.WARNING
            : AdminTimelineSeverity.INFO,
        metadata,
      }),
    ]);
  }

  private toTimelineObjectType(
    targetType: EvidenceAttachmentObjectType,
  ): AdminTimelineObjectType {
    switch (targetType) {
      case EvidenceAttachmentObjectType.TRANSACTION:
      case EvidenceAttachmentObjectType.DELIVERY:
        return AdminTimelineObjectType.TRANSACTION;

      case EvidenceAttachmentObjectType.DISPUTE:
        return AdminTimelineObjectType.DISPUTE;

      case EvidenceAttachmentObjectType.PAYOUT:
        return AdminTimelineObjectType.PAYOUT;

      case EvidenceAttachmentObjectType.REFUND:
        return AdminTimelineObjectType.REFUND;

      case EvidenceAttachmentObjectType.PACKAGE:
      case EvidenceAttachmentObjectType.KYC:
      case EvidenceAttachmentObjectType.ADMIN_CASE:
      case EvidenceAttachmentObjectType.OTHER:
      default:
        return AdminTimelineObjectType.ADMIN_CASE;
    }
  }

  private toTimelineObjectId(item: EvidenceAttachment): string {
    switch (item.targetType) {
      case EvidenceAttachmentObjectType.TRANSACTION:
      case EvidenceAttachmentObjectType.DELIVERY:
      case EvidenceAttachmentObjectType.DISPUTE:
      case EvidenceAttachmentObjectType.PAYOUT:
      case EvidenceAttachmentObjectType.REFUND:
        return item.targetId;

      case EvidenceAttachmentObjectType.PACKAGE:
      case EvidenceAttachmentObjectType.KYC:
      case EvidenceAttachmentObjectType.ADMIN_CASE:
      case EvidenceAttachmentObjectType.OTHER:
      default:
        return item.id;
    }
  }

  private normalizeStorageFields(dto: CreateEvidenceAttachmentDto): {
    fileUrl: string;
    provider: string | null;
    providerUploadId: string | null;
    storageKey: string | null;
    objectUrl: string | null;
    publicUrl: string | null;
    fileName: string | null;
    mimeType: string | null;
  } {
    const provider = this.normalizeOptional(dto.provider);
    const providerUploadId = this.normalizeOptional(dto.providerUploadId);
    const storageKey = this.normalizeOptional(dto.storageKey);
    const objectUrl = this.normalizeOptional(dto.objectUrl);
    const publicUrl = this.normalizeOptional(dto.publicUrl);
    const explicitFileUrl = this.normalizeOptional(dto.fileUrl);

    const fileUrl = explicitFileUrl ?? objectUrl ?? publicUrl ?? storageKey;

    if (!fileUrl) {
      throw new BadRequestException(
        'fileUrl, objectUrl, publicUrl or storageKey is required',
      );
    }

    return {
      fileUrl,
      provider,
      providerUploadId,
      storageKey,
      objectUrl,
      publicUrl,
      fileName: this.normalizeOptional(dto.fileName),
      mimeType: this.normalizeOptional(dto.mimeType)?.toLowerCase() ?? null,
    };
  }

  private normalizeOptional(value?: string | null): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private normalizeRequired(value: string, fieldName: string): string {
    const normalized = String(value ?? '').trim();

    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private toOrderBy(
    sortBy?: EvidenceAttachmentSortBy,
    sortOrder?: SortOrder,
  ): Prisma.EvidenceAttachmentOrderByWithRelationInput[] {
    const direction = sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    switch (sortBy) {
      case EvidenceAttachmentSortBy.UPDATED_AT:
        return [{ updatedAt: direction }, { id: 'desc' }];

      case EvidenceAttachmentSortBy.STATUS:
        return [{ status: direction }, { createdAt: 'desc' }, { id: 'desc' }];

      case EvidenceAttachmentSortBy.TARGET_TYPE:
        return [
          { targetType: direction },
          { createdAt: 'desc' },
          { id: 'desc' },
        ];

      case EvidenceAttachmentSortBy.ATTACHMENT_TYPE:
        return [
          { attachmentType: direction },
          { createdAt: 'desc' },
          { id: 'desc' },
        ];

      case EvidenceAttachmentSortBy.CREATED_AT:
      default:
        return [{ createdAt: direction }, { id: 'desc' }];
    }
  }

  private toAdminReviewQueueItem(
    item: EvidenceAttachment,
  ): EvidenceAdminReviewQueueItem {
    const response = this.toResponse(item);
    const storageCompletenessStatus =
      this.getStorageCompletenessStatus(item);
    const reviewAgeMinutes = this.getAgeMinutes(item.createdAt);
    const isReviewOverdue =
      item.status === EvidenceAttachmentStatus.PENDING_REVIEW &&
      reviewAgeMinutes >= EVIDENCE_REVIEW_OVERDUE_MINUTES;

    const reviewReasons = this.getReviewReasons(
      item,
      reviewAgeMinutes,
      storageCompletenessStatus,
    );

    return {
      ...response,
      reviewAgeMinutes,
      isReviewOverdue,
      reviewPriority: this.getReviewPriority(
        item,
        reviewAgeMinutes,
        storageCompletenessStatus,
      ),
      reviewReasons,
      recommendedAction: this.getRecommendedAction(item, isReviewOverdue),
      storageCompletenessStatus,
    };
  }

  private getAgeMinutes(createdAt: Date): number {
    return Math.max(
      0,
      Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000),
    );
  }

  private getStorageCompletenessStatus(
    item: EvidenceAttachment,
  ): EvidenceStorageCompletenessStatus {
    const hasStructuredProvider = Boolean(item.provider);
    const hasProviderUploadId = Boolean(item.providerUploadId);
    const hasStorageKey = Boolean(item.storageKey);
    const hasObjectOrPublicUrl = Boolean(item.objectUrl || item.publicUrl);

    if (
      hasStructuredProvider &&
      hasProviderUploadId &&
      hasStorageKey &&
      hasObjectOrPublicUrl
    ) {
      return EvidenceStorageCompletenessStatus.COMPLETE;
    }

    if (hasStorageKey || hasObjectOrPublicUrl || hasStructuredProvider) {
      return EvidenceStorageCompletenessStatus.PARTIAL;
    }

    if (item.fileUrl) {
      return EvidenceStorageCompletenessStatus.LEGACY_FILE_URL_ONLY;
    }

    return EvidenceStorageCompletenessStatus.MISSING;
  }

  private getReviewReasons(
    item: EvidenceAttachment,
    reviewAgeMinutes: number,
    storageCompletenessStatus: EvidenceStorageCompletenessStatus,
  ): EvidenceReviewReason[] {
    const reasons: EvidenceReviewReason[] = [];

    if (item.status === EvidenceAttachmentStatus.PENDING_REVIEW) {
      reasons.push(EvidenceReviewReason.PENDING_REVIEW);
    }

    if (
      item.status === EvidenceAttachmentStatus.PENDING_REVIEW &&
      reviewAgeMinutes >= EVIDENCE_REVIEW_OVERDUE_MINUTES
    ) {
      reasons.push(EvidenceReviewReason.REVIEW_OVERDUE);
    } else if (
      item.status === EvidenceAttachmentStatus.PENDING_REVIEW &&
      reviewAgeMinutes >= EVIDENCE_REVIEW_OLD_MINUTES
    ) {
      reasons.push(EvidenceReviewReason.REVIEW_OLD);
    }

    if (
      storageCompletenessStatus === EvidenceStorageCompletenessStatus.COMPLETE
    ) {
      reasons.push(EvidenceReviewReason.STORAGE_COMPLETE);
    }

    if (
      storageCompletenessStatus === EvidenceStorageCompletenessStatus.PARTIAL ||
      storageCompletenessStatus === EvidenceStorageCompletenessStatus.MISSING ||
      storageCompletenessStatus ===
        EvidenceStorageCompletenessStatus.LEGACY_FILE_URL_ONLY
    ) {
      reasons.push(EvidenceReviewReason.STORAGE_INCOMPLETE);
    }

    if (item.status === EvidenceAttachmentStatus.REJECTED) {
      reasons.push(EvidenceReviewReason.REJECTED_ATTACHMENT);
    }

    if (item.status === EvidenceAttachmentStatus.ACCEPTED) {
      reasons.push(EvidenceReviewReason.ACCEPTED_ATTACHMENT);
    }

    return reasons;
  }

  private getReviewPriority(
    item: EvidenceAttachment,
    reviewAgeMinutes: number,
    storageCompletenessStatus: EvidenceStorageCompletenessStatus,
  ): EvidenceReviewPriority {
    if (item.status === EvidenceAttachmentStatus.REJECTED) {
      return EvidenceReviewPriority.HIGH;
    }

    if (item.status === EvidenceAttachmentStatus.ACCEPTED) {
      return EvidenceReviewPriority.LOW;
    }

    if (reviewAgeMinutes >= EVIDENCE_REVIEW_CRITICAL_MINUTES) {
      return EvidenceReviewPriority.CRITICAL;
    }

    if (reviewAgeMinutes >= EVIDENCE_REVIEW_OVERDUE_MINUTES) {
      return EvidenceReviewPriority.HIGH;
    }

    if (
      storageCompletenessStatus === EvidenceStorageCompletenessStatus.MISSING ||
      storageCompletenessStatus === EvidenceStorageCompletenessStatus.PARTIAL
    ) {
      return EvidenceReviewPriority.HIGH;
    }

    if (reviewAgeMinutes >= EVIDENCE_REVIEW_OLD_MINUTES) {
      return EvidenceReviewPriority.MEDIUM;
    }

    return EvidenceReviewPriority.LOW;
  }

  private getRecommendedAction(
    item: EvidenceAttachment,
    isReviewOverdue: boolean,
  ): EvidenceRecommendedAction {
    if (item.status === EvidenceAttachmentStatus.REJECTED) {
      return EvidenceRecommendedAction.REQUEST_RESUBMISSION;
    }

    if (item.status === EvidenceAttachmentStatus.ACCEPTED) {
      return EvidenceRecommendedAction.NO_ACTION_REQUIRED;
    }

    if (isReviewOverdue) {
      return EvidenceRecommendedAction.PRIORITIZE_REVIEW;
    }

    return EvidenceRecommendedAction.REVIEW_ATTACHMENT;
  }

  private toResponse(item: EvidenceAttachment): EvidenceAttachmentResponseDto {
    return {
      id: item.id,
      targetType: item.targetType,
      targetId: item.targetId,
      attachmentType: item.attachmentType,
      status: item.status,
      visibility: item.visibility,
      uploadedById: item.uploadedById,
      reviewedByAdminId: item.reviewedByAdminId,
      reviewedAt: item.reviewedAt,
      label: item.label,
      fileUrl: item.fileUrl,
      provider: item.provider,
      providerUploadId: item.providerUploadId,
      storageKey: item.storageKey,
      objectUrl: item.objectUrl,
      publicUrl: item.publicUrl,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      rejectionReason: item.rejectionReason,
      reviewNotes: item.reviewNotes,
      metadata: this.asRecord(item.metadata),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private asRecord(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      return { value };
    }

    return value as Record<string, unknown>;
  }
}