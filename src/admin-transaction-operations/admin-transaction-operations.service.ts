import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
  AdminTimelineObjectType,
  AdminTimelineSeverity,
  BehaviorRestrictionStatus,
  DisputeStatus,
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentType,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import {
  AdminTransactionOperationItemDto,
  TransactionOperationalSeverity,
  TransactionRecommendedAction,
} from './dto/admin-transaction-operation-item.dto';
import {
  AdminTransactionOperationsQueryDto,
  AdminTransactionOperationsSortBy,
  SortOrder,
} from './dto/admin-transaction-operations-query.dto';
import { AdminTransactionOperationsSummaryDto } from './dto/admin-transaction-operations-summary.dto';
import { AdminTransactionOperationDetailDto } from './dto/admin-transaction-operation-detail.dto';
import {
  AdminTransactionOperationalPriority,
  UpdateAdminTransactionOperationalCaseDto,
} from './dto/update-admin-transaction-operational-case.dto';
import { AdminTransactionOperationalCaseResponseDto } from './dto/admin-transaction-operational-case-response.dto';

type EvidenceSignal = {
  id?: string;
  targetType: EvidenceAttachmentObjectType;
  targetId: string;
  status: EvidenceAttachmentStatus;
  attachmentType: EvidenceAttachmentType;
  createdAt: Date;
};

@Injectable()
export class AdminTransactionOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listQueue(
    query: AdminTransactionOperationsQueryDto,
  ): Promise<PaginatedListResponseDto<AdminTransactionOperationItemDto>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    let items = await this.loadRows();

    if (query.transactionStatus) {
      items = items.filter(
        (item) => item.transactionStatus === query.transactionStatus,
      );
    }

    if (query.paymentStatus) {
      items = items.filter((item) => item.paymentStatus === query.paymentStatus);
    }

    if (query.operationalSeverity) {
      items = items.filter(
        (item) => item.operationalSeverity === query.operationalSeverity,
      );
    }

    if (query.recommendedAction) {
      items = items.filter(
        (item) => item.recommendedAction === query.recommendedAction,
      );
    }

    if (query.requiresAdminAttention !== undefined) {
      items = items.filter(
        (item) => item.requiresAdminAttention === query.requiresAdminAttention,
      );
    }

    if (query.hasOpenDispute !== undefined) {
      items = items.filter(
        (item) => item.hasOpenDispute === query.hasOpenDispute,
      );
    }

    if (query.hasPendingEvidenceReview !== undefined) {
      items = items.filter(
        (item) =>
          item.hasPendingEvidenceReview === query.hasPendingEvidenceReview,
      );
    }

    if (query.hasPendingDisputeEvidenceReview !== undefined) {
      items = items.filter(
        (item) =>
          item.hasPendingDisputeEvidenceReview ===
          query.hasPendingDisputeEvidenceReview,
      );
    }

    if (query.hasPendingDeliveryEvidenceReview !== undefined) {
      items = items.filter(
        (item) =>
          item.hasPendingDeliveryEvidenceReview ===
          query.hasPendingDeliveryEvidenceReview,
      );
    }

    if (query.hasAcceptedDeliveryProof !== undefined) {
      items = items.filter(
        (item) =>
          item.hasAcceptedDeliveryProof === query.hasAcceptedDeliveryProof,
      );
    }

    if (query.hasRejectedDeliveryProof !== undefined) {
      items = items.filter(
        (item) =>
          item.hasRejectedDeliveryProof === query.hasRejectedDeliveryProof,
      );
    }

    if (query.hasPendingRefund !== undefined) {
      items = items.filter(
        (item) => item.hasPendingRefund === query.hasPendingRefund,
      );
    }

    if (query.hasPendingPayout !== undefined) {
      items = items.filter(
        (item) => item.hasPendingPayout === query.hasPendingPayout,
      );
    }

    if (query.hasActiveRestriction !== undefined) {
      items = items.filter(
        (item) => item.hasActiveRestriction === query.hasActiveRestriction,
      );
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();

      items = items.filter((item) => {
        const haystack = [
          item.transactionId,
          item.senderId,
          item.travelerId,
          item.packageId ?? '',
          item.tripId ?? '',
          item.corridorId ?? '',
          item.latestDisputeId ?? '',
          item.latestDisputeStatus ?? '',
          item.latestDeliveryProofStatus ?? '',
          item.transactionStatus,
          item.paymentStatus,
          item.operationalSeverity,
          item.recommendedAction,
          ...item.reasons,
          ...item.pendingEvidenceTargetKeys,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    this.sortItems(items, query.sortBy, query.sortOrder);

    const total = items.length;
    const pagedItems = items.slice(offset, offset + limit);

    return {
      items: pagedItems,
      total,
      limit,
      offset,
      hasMore: offset + pagedItems.length < total,
    };
  }

  async getSummary(): Promise<AdminTransactionOperationsSummaryDto> {
    const items = await this.loadRows();

    return {
      generatedAt: new Date(),
      totalRows: items.length,
      highSeverityCount: items.filter(
        (item) =>
          item.operationalSeverity === TransactionOperationalSeverity.HIGH,
      ).length,
      mediumSeverityCount: items.filter(
        (item) =>
          item.operationalSeverity === TransactionOperationalSeverity.MEDIUM,
      ).length,
      lowSeverityCount: items.filter(
        (item) => item.operationalSeverity === TransactionOperationalSeverity.LOW,
      ).length,
      requiresAdminAttentionCount: items.filter(
        (item) => item.requiresAdminAttention,
      ).length,
      openDisputeCount: items.filter((item) => item.hasOpenDispute).length,
      pendingEvidenceReviewCount: items.filter(
        (item) => item.hasPendingEvidenceReview,
      ).length,
      pendingDisputeEvidenceReviewCount: items.filter(
        (item) => item.hasPendingDisputeEvidenceReview,
      ).length,
      pendingDeliveryEvidenceReviewCount: items.filter(
        (item) => item.hasPendingDeliveryEvidenceReview,
      ).length,
      missingAcceptedDeliveryProofCount: items.filter(
        (item) =>
          item.transactionStatus === TransactionStatus.DELIVERED &&
          !item.hasAcceptedDeliveryProof,
      ).length,
      rejectedDeliveryProofCount: items.filter(
        (item) => item.hasRejectedDeliveryProof,
      ).length,
      pendingPayoutCount: items.filter((item) => item.hasPendingPayout).length,
      pendingRefundCount: items.filter((item) => item.hasPendingRefund).length,
      activeRestrictionCount: items.filter((item) => item.hasActiveRestriction)
        .length,
    };
  }

  async getTransactionDetail(
    transactionId: string,
  ): Promise<AdminTransactionOperationDetailDto> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        disputes: {
          orderBy: [{ createdAt: 'desc' }],
          include: {
            resolution: true,
          },
        },
        payout: true,
        refund: true,
        amlCase: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const latestDispute = transaction.disputes[0] ?? null;

    const evidenceTargetKeys = this.buildEvidenceTargetKeys({
      transactionId: transaction.id,
      packageId: transaction.packageId,
      latestDisputeId: latestDispute?.id ?? null,
    });

    const evidence = await this.prisma.evidenceAttachment.findMany({
      where: {
        OR: evidenceTargetKeys.map((key) => {
          const [targetType, targetId] = key.split(':');

          return {
            targetType: targetType as EvidenceAttachmentObjectType,
            targetId,
          };
        }),
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const restrictions = await this.prisma.behaviorRestriction.findMany({
      where: {
        userId: {
          in: [transaction.senderId, transaction.travelerId],
        },
        status: BehaviorRestrictionStatus.ACTIVE,
      },
      orderBy: [{ imposedAt: 'desc' }],
    });

    const [queueItem] = this.buildQueueItems({
      transactions: [transaction],
      evidenceRows: evidence,
      activeRestrictions: restrictions,
    });

    return {
      queueItem,
      lifecycle: {
        transactionId: transaction.id,
        transactionStatus: transaction.status,
        paymentStatus: transaction.paymentStatus,
        amount: transaction.amount,
        currency: transaction.currency,
        escrowAmount: transaction.escrowAmount,
        commission: transaction.commission,
        senderId: transaction.senderId,
        travelerId: transaction.travelerId,
        packageId: transaction.packageId ?? null,
        tripId: transaction.tripId ?? null,
        corridorId: transaction.corridorId ?? null,
        paymentConfirmedAt: transaction.paymentConfirmedAt ?? null,
        deliveryConfirmedAt: transaction.deliveryConfirmedAt ?? null,
        deliveryCodeGeneratedAt: transaction.deliveryCodeGeneratedAt ?? null,
        deliveryCodeExpiresAt: transaction.deliveryCodeExpiresAt ?? null,
        deliveryCodeConsumedAt: transaction.deliveryCodeConsumedAt ?? null,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
      evidence: evidence.map((item) => ({
        id: item.id,
        targetType: item.targetType,
        targetId: item.targetId,
        attachmentType: item.attachmentType,
        status: item.status,
        label: item.label,
        fileName: item.fileName ?? null,
        mimeType: item.mimeType ?? null,
        sizeBytes: item.sizeBytes ?? null,
        uploadedById: item.uploadedById ?? null,
        reviewedByAdminId: item.reviewedByAdminId ?? null,
        reviewedAt: item.reviewedAt ?? null,
        rejectionReason: item.rejectionReason ?? null,
        reviewNotes: item.reviewNotes ?? null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      disputes: transaction.disputes.map((dispute) => ({
        id: dispute.id,
        status: dispute.status,
        reason: dispute.reason,
        reasonCode: dispute.reasonCode,
        openedById: dispute.openedById,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
        resolutionOutcome: dispute.resolution?.outcome ?? null,
        refundAmount: dispute.resolution?.refundAmount ?? null,
        releaseAmount: dispute.resolution?.releaseAmount ?? null,
      })),
      payout: transaction.payout
        ? {
            id: transaction.payout.id,
            status: transaction.payout.status,
            provider: transaction.payout.provider,
            railProvider: transaction.payout.railProvider ?? null,
            payoutMethodType: transaction.payout.payoutMethodType ?? null,
            amount: transaction.payout.amount,
            currency: transaction.payout.currency,
            externalReference: transaction.payout.externalReference ?? null,
            failureReason: transaction.payout.failureReason ?? null,
            requestedAt: transaction.payout.requestedAt ?? null,
            processedAt: transaction.payout.processedAt ?? null,
            paidAt: transaction.payout.paidAt ?? null,
          }
        : null,
      refund: transaction.refund
        ? {
            id: transaction.refund.id,
            status: transaction.refund.status,
            provider: transaction.refund.provider,
            amount: transaction.refund.amount,
            currency: transaction.refund.currency,
            externalReference: transaction.refund.externalReference ?? null,
            failureReason: transaction.refund.failureReason ?? null,
            requestedAt: transaction.refund.requestedAt ?? null,
            processedAt: transaction.refund.processedAt ?? null,
            refundedAt: transaction.refund.refundedAt ?? null,
          }
        : null,
      amlCase: transaction.amlCase
        ? {
            id: transaction.amlCase.id,
            status: transaction.amlCase.status,
            riskLevel: transaction.amlCase.riskLevel,
            currentAction: transaction.amlCase.currentAction,
            recommendedAction: transaction.amlCase.recommendedAction,
            signalCodes: this.parseStringArray(transaction.amlCase.signalCodes),
            signalCount: transaction.amlCase.signalCount,
            reasonSummary: transaction.amlCase.reasonSummary ?? null,
            openedAt: transaction.amlCase.openedAt,
            resolvedAt: transaction.amlCase.resolvedAt ?? null,
          }
        : null,
      restrictions: restrictions.map((restriction) => ({
        id: restriction.id,
        userId: restriction.userId,
        kind: restriction.kind,
        scope: restriction.scope,
        status: restriction.status,
        reasonCode: restriction.reasonCode,
        reasonSummary: restriction.reasonSummary ?? null,
        imposedAt: restriction.imposedAt,
        expiresAt: restriction.expiresAt ?? null,
      })),
      nextOperationalSteps: this.buildNextOperationalSteps(queueItem),
    };
  }

  async getOperationalCase(
    transactionId: string,
    actorAdminId: string,
  ): Promise<AdminTransactionOperationalCaseResponseDto> {
    await this.ensureTransactionExists(transactionId);

    const existing = await this.prisma.adminOwnership.findUnique({
      where: {
        objectType_objectId: {
          objectType: AdminOwnershipObjectType.TRANSACTION,
          objectId: transactionId,
        },
      },
    });

    if (existing) {
      return this.mapOperationalCase(existing);
    }

    const created = await this.prisma.adminOwnership.create({
      data: {
        objectType: AdminOwnershipObjectType.TRANSACTION,
        objectId: transactionId,
        assignedAdminId: actorAdminId,
        claimedAt: new Date(),
        operationalStatus: AdminOwnershipOperationalStatus.NEW,
        metadata: {
          priority: AdminTransactionOperationalPriority.MEDIUM,
          createdFrom: 'admin_transaction_operations.case',
          latestActionCode: 'CASE_CREATED',
          latestNote: null,
        } as Prisma.InputJsonValue,
      },
    });

    await this.recordOperationalAudit({
      transactionId,
      actorAdminId,
      action: 'TRANSACTION_OPERATIONAL_CASE_CREATED',
      metadata: {
        operationalCaseId: created.id,
        operationalStatus: created.operationalStatus,
        assignedAdminId: actorAdminId,
      },
    });

    await this.recordOperationalTimeline({
      transactionId,
      actorAdminId,
      eventType: 'TRANSACTION_OPERATIONAL_CASE_CREATED',
      title: 'Transaction operational case created',
      message: 'An admin operational case was opened for this transaction.',
      severity: AdminTimelineSeverity.INFO,
      metadata: {
        operationalCaseId: created.id,
        operationalStatus: created.operationalStatus,
        assignedAdminId: actorAdminId,
      },
    });

    return this.mapOperationalCase(created);
  }

  async updateOperationalCase(
    transactionId: string,
    actorAdminId: string,
    dto: UpdateAdminTransactionOperationalCaseDto,
  ): Promise<AdminTransactionOperationalCaseResponseDto> {
    await this.ensureTransactionExists(transactionId);

    const existing =
      (await this.prisma.adminOwnership.findUnique({
        where: {
          objectType_objectId: {
            objectType: AdminOwnershipObjectType.TRANSACTION,
            objectId: transactionId,
          },
        },
      })) ??
      (await this.prisma.adminOwnership.create({
        data: {
          objectType: AdminOwnershipObjectType.TRANSACTION,
          objectId: transactionId,
          assignedAdminId: actorAdminId,
          claimedAt: new Date(),
          operationalStatus: AdminOwnershipOperationalStatus.NEW,
          metadata: {
            priority: AdminTransactionOperationalPriority.MEDIUM,
            createdFrom: 'admin_transaction_operations.update',
            latestActionCode: 'CASE_CREATED',
            latestNote: null,
          } as Prisma.InputJsonValue,
        },
      }));

    const now = new Date();
    const previousMetadata = this.asObject(existing.metadata);
    const nextPriority =
      dto.priority ??
      this.extractPriority(previousMetadata) ??
      AdminTransactionOperationalPriority.MEDIUM;

    const nextOperationalStatus =
      dto.operationalStatus ?? existing.operationalStatus;

    const nextAssignedAdminId =
      dto.assignedAdminId !== undefined
        ? dto.assignedAdminId || null
        : existing.assignedAdminId ?? actorAdminId;

    const actionCode =
      dto.actionCode ??
      this.defaultActionCodeForStatus(nextOperationalStatus);

    const nextMetadata = {
      ...previousMetadata,
      ...(dto.metadata ?? {}),
      priority: nextPriority,
      latestActionCode: actionCode,
      latestNote: dto.note ?? previousMetadata.latestNote ?? null,
      lastUpdatedByAdminId: actorAdminId,
      lastUpdatedAt: now.toISOString(),
      previousOperationalStatus: existing.operationalStatus,
      currentOperationalStatus: nextOperationalStatus,
    };

    const updated = await this.prisma.adminOwnership.update({
      where: { id: existing.id },
      data: {
        assignedAdminId: nextAssignedAdminId,
        claimedAt:
          nextAssignedAdminId && !existing.claimedAt ? now : existing.claimedAt,
        operationalStatus: nextOperationalStatus,
        completedAt:
          nextOperationalStatus === AdminOwnershipOperationalStatus.DONE ||
          nextOperationalStatus === AdminOwnershipOperationalStatus.RELEASED
            ? now
            : null,
        releasedAt:
          nextOperationalStatus === AdminOwnershipOperationalStatus.RELEASED
            ? now
            : existing.releasedAt,
        metadata: nextMetadata as Prisma.InputJsonValue,
      },
    });

    await this.recordOperationalAudit({
      transactionId,
      actorAdminId,
      action: 'TRANSACTION_OPERATIONAL_CASE_UPDATED',
      metadata: {
        operationalCaseId: updated.id,
        previousOperationalStatus: existing.operationalStatus,
        operationalStatus: updated.operationalStatus,
        previousAssignedAdminId: existing.assignedAdminId ?? null,
        assignedAdminId: updated.assignedAdminId ?? null,
        priority: nextPriority,
        actionCode,
        note: dto.note ?? null,
      },
    });

    await this.recordOperationalTimeline({
      transactionId,
      actorAdminId,
      eventType: 'TRANSACTION_OPERATIONAL_CASE_UPDATED',
      title: this.timelineTitleForAction(actionCode),
      message:
        dto.note ??
        `Operational case updated to ${updated.operationalStatus}.`,
      severity: this.timelineSeverityForStatus(updated.operationalStatus),
      metadata: {
        operationalCaseId: updated.id,
        previousOperationalStatus: existing.operationalStatus,
        operationalStatus: updated.operationalStatus,
        assignedAdminId: updated.assignedAdminId ?? null,
        priority: nextPriority,
        actionCode,
      },
    });

    return this.mapOperationalCase(updated);
  }

  private async ensureTransactionExists(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  private mapOperationalCase(row: {
    id: string;
    objectType: AdminOwnershipObjectType;
    objectId: string;
    assignedAdminId: string | null;
    claimedAt: Date | null;
    releasedAt: Date | null;
    operationalStatus: AdminOwnershipOperationalStatus;
    slaDueAt: Date | null;
    completedAt: Date | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }): AdminTransactionOperationalCaseResponseDto {
    const metadata = this.asObject(row.metadata);
    const priority =
      this.extractPriority(metadata) ?? AdminTransactionOperationalPriority.MEDIUM;

    return {
      id: row.id,
      objectType: row.objectType,
      transactionId: row.objectId,
      assignedAdminId: row.assignedAdminId ?? null,
      claimedAt: row.claimedAt ?? null,
      releasedAt: row.releasedAt ?? null,
      operationalStatus: row.operationalStatus,
      priority,
      latestNote:
        typeof metadata.latestNote === 'string' ? metadata.latestNote : null,
      latestActionCode:
        typeof metadata.latestActionCode === 'string'
          ? metadata.latestActionCode
          : null,
      slaDueAt: row.slaDueAt ?? null,
      completedAt: row.completedAt ?? null,
      metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async recordOperationalAudit(input: {
    transactionId: string;
    actorAdminId: string;
    action: string;
    metadata: Record<string, unknown>;
  }) {
    await this.prisma.adminActionAudit.create({
      data: {
        action: input.action,
        targetType: 'TRANSACTION',
        targetId: input.transactionId,
        actorUserId: input.actorAdminId,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });
  }

  private async recordOperationalTimeline(input: {
    transactionId: string;
    actorAdminId: string;
    eventType: string;
    title: string;
    message: string;
    severity: AdminTimelineSeverity;
    metadata: Record<string, unknown>;
  }) {
    await this.prisma.adminTimelineEvent.create({
      data: {
        objectType: AdminTimelineObjectType.TRANSACTION,
        objectId: input.transactionId,
        eventType: input.eventType,
        title: input.title,
        message: input.message,
        actorUserId: input.actorAdminId,
        severity: input.severity,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });
  }

  private asObject(value: Prisma.JsonValue | null | undefined) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private extractPriority(
    metadata: Record<string, unknown>,
  ): AdminTransactionOperationalPriority | null {
    const value = metadata.priority;

    if (
      value === AdminTransactionOperationalPriority.LOW ||
      value === AdminTransactionOperationalPriority.MEDIUM ||
      value === AdminTransactionOperationalPriority.HIGH ||
      value === AdminTransactionOperationalPriority.CRITICAL
    ) {
      return value;
    }

    return null;
  }

  private defaultActionCodeForStatus(
    status: AdminOwnershipOperationalStatus,
  ): string {
    if (status === AdminOwnershipOperationalStatus.IN_REVIEW) {
      return 'MANUAL_REVIEW_STARTED';
    }

    if (status === AdminOwnershipOperationalStatus.WAITING_EXTERNAL) {
      return 'WAITING_EXTERNAL_PARTY';
    }

    if (status === AdminOwnershipOperationalStatus.DONE) {
      return 'CASE_RESOLVED';
    }

    if (status === AdminOwnershipOperationalStatus.RELEASED) {
      return 'CASE_RELEASED';
    }

    if (status === AdminOwnershipOperationalStatus.CLAIMED) {
      return 'CASE_CLAIMED';
    }

    return 'CASE_UPDATED';
  }

  private timelineTitleForAction(actionCode: string): string {
    const labels: Record<string, string> = {
      CASE_CREATED: 'Transaction operational case created',
      CASE_UPDATED: 'Transaction operational case updated',
      CASE_CLAIMED: 'Transaction operational case claimed',
      MANUAL_REVIEW_STARTED: 'Manual review started',
      WAITING_EXTERNAL_PARTY: 'Waiting for external party',
      REQUEST_EVIDENCE_RESUBMISSION: 'Evidence resubmission requested',
      DELIVERY_FOLLOW_UP_REQUIRED: 'Delivery follow-up required',
      CASE_RESOLVED: 'Transaction operational case resolved',
      CASE_RELEASED: 'Transaction operational case released',
    };

    return labels[actionCode] ?? 'Transaction operational case updated';
  }

  private timelineSeverityForStatus(
    status: AdminOwnershipOperationalStatus,
  ): AdminTimelineSeverity {
    if (status === AdminOwnershipOperationalStatus.DONE) {
      return AdminTimelineSeverity.SUCCESS;
    }

    if (status === AdminOwnershipOperationalStatus.RELEASED) {
      return AdminTimelineSeverity.SUCCESS;
    }

    if (status === AdminOwnershipOperationalStatus.WAITING_EXTERNAL) {
      return AdminTimelineSeverity.WARNING;
    }

    return AdminTimelineSeverity.INFO;
  }

  private async loadRows(): Promise<AdminTransactionOperationItemDto[]> {
    const [transactions, evidenceRows, activeRestrictions] = await Promise.all([
      this.prisma.transaction.findMany({
        orderBy: [{ updatedAt: 'desc' }],
        take: 500,
        include: {
          disputes: {
            orderBy: [{ createdAt: 'desc' }],
            take: 1,
            select: {
              id: true,
              status: true,
            },
          },
          payout: {
            select: {
              id: true,
              status: true,
            },
          },
          refund: {
            select: {
              id: true,
              status: true,
            },
          },
          amlCase: {
            select: {
              id: true,
              currentAction: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.evidenceAttachment.findMany({
        where: {
          targetType: {
            in: [
              EvidenceAttachmentObjectType.TRANSACTION,
              EvidenceAttachmentObjectType.PACKAGE,
              EvidenceAttachmentObjectType.DISPUTE,
              EvidenceAttachmentObjectType.DELIVERY,
            ],
          },
        },
        select: {
          id: true,
          targetType: true,
          targetId: true,
          status: true,
          attachmentType: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 2000,
      }),
      this.prisma.behaviorRestriction.findMany({
        where: {
          status: BehaviorRestrictionStatus.ACTIVE,
        },
        select: {
          userId: true,
        },
        take: 1000,
      }),
    ]);

    return this.buildQueueItems({
      transactions,
      evidenceRows,
      activeRestrictions,
    });
  }

  private buildQueueItems(input: {
    transactions: any[];
    evidenceRows: EvidenceSignal[];
    activeRestrictions: Array<{ userId: string }>;
  }): AdminTransactionOperationItemDto[] {
    const evidenceByTargetKey = this.groupEvidenceByTargetKey(
      input.evidenceRows,
    );
    const restrictedUserIds = new Set(
      input.activeRestrictions.map((item) => item.userId),
    );

    return input.transactions.map((tx) => {
      const latestDispute = tx.disputes?.[0] ?? null;
      const targetKeys = this.buildEvidenceTargetKeys({
        transactionId: tx.id,
        packageId: tx.packageId,
        latestDisputeId: latestDispute?.id ?? null,
      });

      const relatedEvidence = targetKeys.flatMap(
        (key) => evidenceByTargetKey.get(key) ?? [],
      );

      const pendingEvidence = relatedEvidence.filter(
        (item) => item.status === EvidenceAttachmentStatus.PENDING_REVIEW,
      );

      const disputeEvidence = latestDispute
        ? evidenceByTargetKey.get(
            this.targetKey(
              EvidenceAttachmentObjectType.DISPUTE,
              latestDispute.id,
            ),
          ) ?? []
        : [];

      const deliveryEvidence = relatedEvidence.filter(
        (item) =>
          item.targetType === EvidenceAttachmentObjectType.DELIVERY ||
          item.attachmentType === EvidenceAttachmentType.DELIVERY_PROOF,
      );

      const pendingDisputeEvidence = disputeEvidence.filter(
        (item) => item.status === EvidenceAttachmentStatus.PENDING_REVIEW,
      );

      const pendingDeliveryEvidence = deliveryEvidence.filter(
        (item) => item.status === EvidenceAttachmentStatus.PENDING_REVIEW,
      );

      const latestDeliveryProof = deliveryEvidence[0] ?? null;
      const hasOpenDispute = latestDispute?.status === DisputeStatus.OPEN;

      const hasPendingPayout =
        tx.payout?.status === PayoutStatus.REQUESTED ||
        tx.payout?.status === PayoutStatus.PROCESSING;

      const hasPendingRefund =
        tx.refund?.status === RefundStatus.REQUESTED ||
        tx.refund?.status === RefundStatus.PROCESSING;

      const hasActiveRestriction =
        restrictedUserIds.has(tx.senderId) || restrictedUserIds.has(tx.travelerId);

      const hasPendingEvidenceReview = pendingEvidence.length > 0;
      const hasPendingDisputeEvidenceReview =
        pendingDisputeEvidence.length > 0;
      const hasPendingDeliveryEvidenceReview =
        pendingDeliveryEvidence.length > 0;
      const hasAcceptedDeliveryProof = deliveryEvidence.some(
        (item) => item.status === EvidenceAttachmentStatus.ACCEPTED,
      );
      const hasRejectedDeliveryProof = deliveryEvidence.some(
        (item) => item.status === EvidenceAttachmentStatus.REJECTED,
      );

      const reasons = this.buildReasons({
        transactionStatus: tx.status,
        paymentStatus: tx.paymentStatus,
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDisputeEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasAcceptedDeliveryProof,
        hasRejectedDeliveryProof,
        hasPendingPayout,
        hasPendingRefund,
        hasActiveRestriction,
      });

      const operationalSeverity = this.resolveSeverity({
        transactionStatus: tx.status,
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDisputeEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasAcceptedDeliveryProof,
        hasRejectedDeliveryProof,
        hasPendingPayout,
        hasPendingRefund,
        hasActiveRestriction,
      });

      const recommendedAction = this.resolveRecommendedAction({
        transactionStatus: tx.status,
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDisputeEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasAcceptedDeliveryProof,
        hasRejectedDeliveryProof,
        hasPendingPayout,
        hasPendingRefund,
        hasActiveRestriction,
      });

      const requiresAdminAttention =
        operationalSeverity !== TransactionOperationalSeverity.LOW ||
        recommendedAction !== TransactionRecommendedAction.NO_ACTION_REQUIRED;

      return {
        transactionId: tx.id,
        transactionStatus: tx.status,
        paymentStatus: tx.paymentStatus,
        amount: tx.amount,
        currency: tx.currency,
        senderId: tx.senderId,
        travelerId: tx.travelerId,
        packageId: tx.packageId ?? null,
        tripId: tx.tripId ?? null,
        corridorId: tx.corridorId ?? null,
        hasOpenDispute,
        latestDisputeId: latestDispute?.id ?? null,
        latestDisputeStatus: latestDispute?.status ?? null,
        hasPendingEvidenceReview,
        pendingEvidenceReviewCount: pendingEvidence.length,
        hasPendingDisputeEvidenceReview,
        pendingDisputeEvidenceReviewCount: pendingDisputeEvidence.length,
        hasPendingDeliveryEvidenceReview,
        pendingDeliveryEvidenceReviewCount: pendingDeliveryEvidence.length,
        hasAcceptedDeliveryProof,
        hasRejectedDeliveryProof,
        latestDeliveryProofStatus: latestDeliveryProof?.status ?? null,
        hasPendingRefund,
        hasPendingPayout,
        hasActiveRestriction,
        requiresAdminAttention,
        operationalSeverity,
        recommendedAction,
        reasons,
        pendingEvidenceTargetKeys: pendingEvidence.map((item) =>
          this.targetKey(item.targetType, item.targetId),
        ),
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      };
    });
  }

  private buildEvidenceTargetKeys(input: {
    transactionId: string;
    packageId?: string | null;
    latestDisputeId?: string | null;
  }): string[] {
    const keys = [
      this.targetKey(
        EvidenceAttachmentObjectType.TRANSACTION,
        input.transactionId,
      ),
      this.targetKey(EvidenceAttachmentObjectType.DELIVERY, input.transactionId),
    ];

    if (input.packageId) {
      keys.push(
        this.targetKey(EvidenceAttachmentObjectType.PACKAGE, input.packageId),
      );
    }

    if (input.latestDisputeId) {
      keys.push(
        this.targetKey(
          EvidenceAttachmentObjectType.DISPUTE,
          input.latestDisputeId,
        ),
      );
    }

    return keys;
  }

  private groupEvidenceByTargetKey(rows: EvidenceSignal[]) {
    const map = new Map<string, EvidenceSignal[]>();

    for (const row of rows) {
      const key = this.targetKey(row.targetType, row.targetId);
      const existing = map.get(key) ?? [];
      existing.push(row);
      map.set(key, existing);
    }

    return map;
  }

  private targetKey(targetType: EvidenceAttachmentObjectType, targetId: string) {
    return `${targetType}:${targetId}`;
  }

  private buildReasons(input: {
    transactionStatus: TransactionStatus;
    paymentStatus: PaymentStatus;
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDisputeEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasAcceptedDeliveryProof: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingPayout: boolean;
    hasPendingRefund: boolean;
    hasActiveRestriction: boolean;
  }): string[] {
    const reasons: string[] = [];

    if (input.hasOpenDispute) {
      reasons.push('OPEN_DISPUTE');
    }

    if (input.hasPendingEvidenceReview) {
      reasons.push('PENDING_EVIDENCE_REVIEW');
    }

    if (input.hasPendingDisputeEvidenceReview) {
      reasons.push('PENDING_DISPUTE_EVIDENCE_REVIEW');
    }

    if (input.hasPendingDeliveryEvidenceReview) {
      reasons.push('PENDING_DELIVERY_EVIDENCE_REVIEW');
    }

    if (input.hasRejectedDeliveryProof) {
      reasons.push('REJECTED_DELIVERY_PROOF');
    }

    if (
      input.transactionStatus === TransactionStatus.DELIVERED &&
      !input.hasAcceptedDeliveryProof
    ) {
      reasons.push('DELIVERED_WITHOUT_ACCEPTED_DELIVERY_PROOF');
    }

    if (input.hasPendingPayout) {
      reasons.push('PENDING_PAYOUT');
    }

    if (input.hasPendingRefund) {
      reasons.push('PENDING_REFUND');
    }

    if (input.hasActiveRestriction) {
      reasons.push('ACTIVE_USER_RESTRICTION');
    }

    if (input.paymentStatus !== PaymentStatus.SUCCESS) {
      reasons.push('PAYMENT_NOT_CONFIRMED');
    }

    return reasons;
  }

  private resolveSeverity(input: {
    transactionStatus: TransactionStatus;
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDisputeEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasAcceptedDeliveryProof: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingPayout: boolean;
    hasPendingRefund: boolean;
    hasActiveRestriction: boolean;
  }): TransactionOperationalSeverity {
    if (
      (input.hasOpenDispute && input.hasPendingEvidenceReview) ||
      input.hasPendingDisputeEvidenceReview ||
      input.hasRejectedDeliveryProof
    ) {
      return TransactionOperationalSeverity.HIGH;
    }

    if (
      input.hasOpenDispute ||
      input.hasPendingDeliveryEvidenceReview ||
      input.hasPendingEvidenceReview ||
      input.hasPendingRefund ||
      input.hasPendingPayout ||
      input.hasActiveRestriction ||
      (input.transactionStatus === TransactionStatus.DELIVERED &&
        !input.hasAcceptedDeliveryProof)
    ) {
      return TransactionOperationalSeverity.MEDIUM;
    }

    return TransactionOperationalSeverity.LOW;
  }

  private resolveRecommendedAction(input: {
    transactionStatus: TransactionStatus;
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDisputeEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasAcceptedDeliveryProof: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingPayout: boolean;
    hasPendingRefund: boolean;
    hasActiveRestriction: boolean;
  }): TransactionRecommendedAction {
    if (input.hasOpenDispute && input.hasPendingEvidenceReview) {
      return TransactionRecommendedAction.REVIEW_DISPUTE_AND_EVIDENCE;
    }

    if (input.hasOpenDispute) {
      return TransactionRecommendedAction.REVIEW_DISPUTE;
    }

    if (
      input.hasPendingDeliveryEvidenceReview ||
      input.hasRejectedDeliveryProof
    ) {
      return TransactionRecommendedAction.REVIEW_DELIVERY_PROOF;
    }

    if (input.hasPendingEvidenceReview) {
      return TransactionRecommendedAction.REVIEW_EVIDENCE;
    }

    if (input.hasActiveRestriction) {
      return TransactionRecommendedAction.REVIEW_USER_RESTRICTION;
    }

    if (input.hasPendingPayout) {
      return TransactionRecommendedAction.MONITOR_PAYOUT;
    }

    if (input.hasPendingRefund) {
      return TransactionRecommendedAction.MONITOR_REFUND;
    }

    if (
      input.transactionStatus === TransactionStatus.DELIVERED &&
      !input.hasAcceptedDeliveryProof
    ) {
      return TransactionRecommendedAction.REVIEW_DELIVERY_READINESS;
    }

    return TransactionRecommendedAction.NO_ACTION_REQUIRED;
  }

  private buildNextOperationalSteps(
    queueItem: AdminTransactionOperationItemDto,
  ): string[] {
    const steps: string[] = [];

    if (queueItem.hasOpenDispute) {
      steps.push('Review the open dispute and decide whether evidence is sufficient.');
    }

    if (queueItem.hasPendingDisputeEvidenceReview) {
      steps.push('Review pending dispute evidence attachments.');
    }

    if (queueItem.hasPendingDeliveryEvidenceReview) {
      steps.push('Review pending delivery proof attachments.');
    }

    if (queueItem.hasRejectedDeliveryProof) {
      steps.push('Ask for corrected delivery proof or review delivery status manually.');
    }

    if (
      queueItem.transactionStatus === TransactionStatus.DELIVERED &&
      !queueItem.hasAcceptedDeliveryProof
    ) {
      steps.push('Confirm whether delivery proof is required before financial closure.');
    }

    if (queueItem.hasActiveRestriction) {
      steps.push('Review active sender/traveler restrictions before allowing further action.');
    }

    if (queueItem.hasPendingPayout) {
      steps.push('Monitor payout processing and reconcile provider events if needed.');
    }

    if (queueItem.hasPendingRefund) {
      steps.push('Monitor refund processing and reconcile provider events if needed.');
    }

    if (steps.length === 0) {
      steps.push('No immediate admin action required.');
    }

    return steps;
  }

  private sortItems(
    items: AdminTransactionOperationItemDto[],
    sortBy = AdminTransactionOperationsSortBy.UPDATED_AT,
    sortOrder = SortOrder.DESC,
  ) {
    const severityRank: Record<TransactionOperationalSeverity, number> = {
      [TransactionOperationalSeverity.HIGH]: 3,
      [TransactionOperationalSeverity.MEDIUM]: 2,
      [TransactionOperationalSeverity.LOW]: 1,
    };

    items.sort((a, b) => {
      let compare = 0;

      switch (sortBy) {
        case AdminTransactionOperationsSortBy.CREATED_AT:
          compare = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case AdminTransactionOperationsSortBy.SEVERITY:
          compare =
            severityRank[a.operationalSeverity] -
            severityRank[b.operationalSeverity];
          break;
        case AdminTransactionOperationsSortBy.AMOUNT:
          compare = a.amount - b.amount;
          break;
        case AdminTransactionOperationsSortBy.PENDING_EVIDENCE:
          compare =
            a.pendingEvidenceReviewCount - b.pendingEvidenceReviewCount;
          break;
        case AdminTransactionOperationsSortBy.UPDATED_AT:
        default:
          compare = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
      }

      return sortOrder === SortOrder.ASC ? compare : -compare;
    });
  }

  private parseStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }
}