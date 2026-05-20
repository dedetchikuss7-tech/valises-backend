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
import { ResolveAdminTransactionOperationalCaseDto } from './dto/resolve-admin-transaction-operational-case.dto';
import { ReopenAdminTransactionOperationalCaseDto } from './dto/reopen-admin-transaction-operational-case.dto';
import { AdminTransactionOperationalResolutionStatus } from './dto/admin-transaction-operational-case-response.dto';
import {
  AdminTransactionOperationalAutomationDto,
  TransactionAutomationBlockerCode,
  TransactionAutomationCandidateCode,
  TransactionAutomationReadiness,
} from './dto/admin-transaction-operational-automation.dto';
import {
  AdminTransactionOperationalResolutionDto,
  TransactionOperationalResolutionBlockerCode,
  TransactionOperationalSuggestedResolution,
} from './dto/admin-transaction-operational-resolution.dto';
import {
  AdminTransactionOperationalCockpitDto,
  TransactionAutomationReadinessBand,
  TransactionHumanAttentionLevel,
  TransactionOperationalRiskBand,
  TransactionOperationalUrgencyBand,
} from './dto/admin-transaction-operational-cockpit.dto';
import {
  AdminTransactionOperationalOwnershipDto,
  TransactionOperationalOwnershipProfile,
  TransactionOperationalOwnershipSeniority,
} from './dto/admin-transaction-operational-ownership.dto';
import {
  AdminTransactionOperationalRoutingDto,
  TransactionOperationalRoutingTeam,
  TransactionOperationalRoutingUrgency,
} from './dto/admin-transaction-operational-routing.dto';
import {
  AdminTransactionOperationalExecutionReadinessDto,
  TransactionOperationalExecutableAction,
  TransactionOperationalExecutableActionReadinessDto,
  TransactionOperationalExecutionBlockerSeverity,
  TransactionOperationalExecutionConfidence,
  TransactionOperationalExecutionPrerequisiteStatus,
} from './dto/admin-transaction-operational-execution-readiness.dto';
import {
  AdminTransactionOperationalDecisionMatrixDto,
  TransactionOperationalDecisionAction,
  TransactionOperationalDecisionBlockerCode,
  TransactionOperationalDecisionRuleDto,
  TransactionOperationalDecisionStatus,
} from './dto/admin-transaction-operational-decision.dto';
import {
  AdminTransactionOperationalWorkflowDto,
  AdminTransactionOperationalWorkflowStatus,
} from './dto/admin-transaction-operational-workflow.dto';

type QueueTransaction = Prisma.TransactionGetPayload<{
  include: {
    disputes: {
      include: {
        resolution: true;
      };
    };
    payout: true;
    refund: true;
    amlCase: true;
  };
}>;

type EvidenceSignal = {
  id: string;
  targetType: EvidenceAttachmentObjectType;
  targetId: string;
  status: EvidenceAttachmentStatus;
  attachmentType: EvidenceAttachmentType;
  createdAt: Date;
};

@Injectable()
export class AdminTransactionOperationsService {
  private static readonly STALE_TRANSACTION_MINUTES = 60 * 24 * 3;
  private static readonly OPEN_DISPUTE_ESCALATION_MINUTES = 60 * 24 * 2;
  private static readonly PENDING_EVIDENCE_ESCALATION_MINUTES = 60 * 24;
  private static readonly PENDING_PAYOUT_ESCALATION_MINUTES = 60 * 24;
  private static readonly PENDING_REFUND_ESCALATION_MINUTES = 60 * 24;
  private static readonly OPERATIONAL_CASE_ESCALATION_MINUTES = 60 * 24 * 2;

  constructor(private readonly prisma: PrismaService) {}

  async listQueue(
    query: AdminTransactionOperationsQueryDto,
  ): Promise<PaginatedListResponseDto<AdminTransactionOperationItemDto>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    let items = await this.loadRows();

    items = this.applyFilters(items, query);
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
        (item) => item.operationalSeverity === TransactionOperationalSeverity.HIGH,
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
      requiresEscalationCount: items.filter((item) => item.requiresEscalation)
        .length,
      overdueCount: items.filter((item) => item.isOverdue).length,
      staleCount: items.filter((item) => item.isStale).length,
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
      operationalCaseCount: items.filter((item) => item.hasOperationalCase)
        .length,
      unassignedOperationalCaseCount: items.filter(
        (item) => item.hasOperationalCase && !item.assignedAdminId,
      ).length,
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
          include: { resolution: true },
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

    const operationalCase = await this.prisma.adminOwnership.findUnique({
      where: {
        objectType_objectId: {
          objectType: AdminOwnershipObjectType.TRANSACTION,
          objectId: transaction.id,
        },
      },
    });

    const [queueItem] = this.buildQueueItems({
      transactions: [transaction],
      evidenceRows: evidence,
      activeRestrictions: restrictions,
      operationalCases: operationalCase ? [operationalCase] : [],
    });

    const automation = this.buildAutomationReadiness({
      transactionStatus: transaction.status,
      hasOpenDispute: queueItem.hasOpenDispute,
      hasPendingEvidenceReview: queueItem.hasPendingEvidenceReview,
      hasRejectedDeliveryProof: queueItem.hasRejectedDeliveryProof,
      hasPendingRefund: queueItem.hasPendingRefund,
      hasPendingPayout: queueItem.hasPendingPayout,
      hasActiveRestriction: queueItem.hasActiveRestriction,
      requiresEscalation: queueItem.requiresEscalation,
      isOverdue: queueItem.isOverdue,
      isStale: queueItem.isStale,
      amlCaseExists: Boolean(transaction.amlCase),
    });

    const resolution = this.buildResolutionSuggestion({
      hasOpenDispute: queueItem.hasOpenDispute,
      hasPendingEvidenceReview: queueItem.hasPendingEvidenceReview,
      hasPendingDisputeEvidenceReview:
        queueItem.hasPendingDisputeEvidenceReview,
      hasPendingDeliveryEvidenceReview:
        queueItem.hasPendingDeliveryEvidenceReview,
      hasRejectedDeliveryProof: queueItem.hasRejectedDeliveryProof,
      hasPendingRefund: queueItem.hasPendingRefund,
      hasPendingPayout: queueItem.hasPendingPayout,
      hasActiveRestriction: queueItem.hasActiveRestriction,
      requiresEscalation: queueItem.requiresEscalation,
      amlCaseExists: Boolean(transaction.amlCase),
      operationalCaseStatus: queueItem.operationalCaseStatus
        ? (queueItem.operationalCaseStatus as AdminOwnershipOperationalStatus)
        : null,
      automationReadiness: automation.readiness,
    });

    const executionReadiness = this.buildExecutionReadiness({
      transactionStatus: transaction.status,
      paymentStatus: transaction.paymentStatus,
      hasOpenDispute: queueItem.hasOpenDispute,
      hasPendingEvidenceReview: queueItem.hasPendingEvidenceReview,
      hasPendingDeliveryEvidenceReview:
        queueItem.hasPendingDeliveryEvidenceReview,
      hasRejectedDeliveryProof: queueItem.hasRejectedDeliveryProof,
      hasAcceptedDeliveryProof: queueItem.hasAcceptedDeliveryProof,
      hasPendingRefund: queueItem.hasPendingRefund,
      hasPendingPayout: queueItem.hasPendingPayout,
      hasActiveRestriction: queueItem.hasActiveRestriction,
      requiresEscalation: queueItem.requiresEscalation,
      amlCaseExists: Boolean(transaction.amlCase),
      automationReadiness: automation.readiness,
      suggestedResolution: resolution.suggestedResolution,
    });

    const decisionMatrix = this.buildDecisionMatrix({
      transactionStatus: transaction.status,
      paymentStatus: transaction.paymentStatus,
      hasOpenDispute: queueItem.hasOpenDispute,
      hasPendingEvidenceReview: queueItem.hasPendingEvidenceReview,
      hasPendingDeliveryEvidenceReview:
        queueItem.hasPendingDeliveryEvidenceReview,
      hasRejectedDeliveryProof: queueItem.hasRejectedDeliveryProof,
      hasPendingRefund: queueItem.hasPendingRefund,
      hasPendingPayout: queueItem.hasPendingPayout,
      hasActiveRestriction: queueItem.hasActiveRestriction,
      requiresEscalation: queueItem.requiresEscalation,
      isOverdue: queueItem.isOverdue,
      amlCaseExists: Boolean(transaction.amlCase),
      automationReadiness: automation.readiness,
      canAutoResolve: resolution.canAutoResolve,
    });

    const ownership = this.buildOperationalOwnership({
      hasOpenDispute: queueItem.hasOpenDispute,
      hasPendingEvidenceReview: queueItem.hasPendingEvidenceReview,
      hasPendingDeliveryEvidenceReview:
        queueItem.hasPendingDeliveryEvidenceReview,
      hasRejectedDeliveryProof: queueItem.hasRejectedDeliveryProof,
      hasPendingRefund: queueItem.hasPendingRefund,
      hasPendingPayout: queueItem.hasPendingPayout,
      hasActiveRestriction: queueItem.hasActiveRestriction,
      requiresEscalation: queueItem.requiresEscalation,
      amlCaseExists: Boolean(transaction.amlCase),
      operationalSeverity: queueItem.operationalSeverity,
    });

    const cockpit = this.buildOperationalCockpit({
      operationalSeverity: queueItem.operationalSeverity,
      requiresEscalation: queueItem.requiresEscalation,
      hasOpenDispute: queueItem.hasOpenDispute,
      hasPendingEvidenceReview:
        queueItem.hasPendingEvidenceReview,
      hasPendingDeliveryEvidenceReview:
        queueItem.hasPendingDeliveryEvidenceReview,
      hasPendingRefund: queueItem.hasPendingRefund,
      hasPendingPayout: queueItem.hasPendingPayout,
      hasActiveRestriction:
        queueItem.hasActiveRestriction,
      isOverdue: queueItem.isOverdue,
      automationConfidenceScore:
        queueItem.automation.confidenceScore,
      automationRequiresHumanReview:
        queueItem.automation.requiresHumanReview,
      routingEscalationRequired:
        queueItem.routing.requiresImmediateAttention,
    });

    const routing = this.buildOperationalRouting({
      hasOpenDispute: queueItem.hasOpenDispute,
      hasPendingEvidenceReview: queueItem.hasPendingEvidenceReview,
      hasPendingDeliveryEvidenceReview:
        queueItem.hasPendingDeliveryEvidenceReview,
      hasRejectedDeliveryProof: queueItem.hasRejectedDeliveryProof,
      hasPendingRefund: queueItem.hasPendingRefund,
      hasPendingPayout: queueItem.hasPendingPayout,
      hasActiveRestriction: queueItem.hasActiveRestriction,
      requiresEscalation: queueItem.requiresEscalation,
      amlCaseExists: Boolean(transaction.amlCase),
      operationalSeverity: queueItem.operationalSeverity,
    });

    return {
      queueItem,
      operationalCase: operationalCase
        ? this.mapOperationalCase(operationalCase)
        : null,
      lifecycle: {
        automation,
        decisionMatrix,
        routing,
        ownership,
        cockpit,
        workflow: queueItem.workflow,
        executionReadiness,
        resolution,
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
      dto.actionCode ?? this.defaultActionCodeForStatus(nextOperationalStatus);

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
        dto.note ?? `Operational case updated to ${updated.operationalStatus}.`,
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

    async resolveOperationalCase(
    transactionId: string,
    actorAdminId: string,
    dto: ResolveAdminTransactionOperationalCaseDto,
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
            createdFrom: 'admin_transaction_operations.resolve',
            latestActionCode: 'CASE_CREATED',
            latestNote: null,
          } as Prisma.InputJsonValue,
        },
      }));

    const now = new Date();
    const previousMetadata = this.asObject(existing.metadata);

    const nextMetadata = {
      ...previousMetadata,
      ...(dto.metadata ?? {}),
      operationalResolutionStatus:
        AdminTransactionOperationalResolutionStatus.RESOLVED,
      operationalResolutionCategory: dto.resolutionCategory,
      operationalResolutionCode: dto.resolutionCode ?? null,
      operationalResolutionSummary: dto.resolutionSummary,
      operationalResolvedAt: now.toISOString(),
      operationalResolvedById: actorAdminId,
      latestActionCode: 'OPERATIONAL_CASE_RESOLVED',
      latestNote: dto.resolutionSummary,
      lastUpdatedByAdminId: actorAdminId,
      lastUpdatedAt: now.toISOString(),
      previousOperationalStatus: existing.operationalStatus,
      currentOperationalStatus: AdminOwnershipOperationalStatus.DONE,
    };

    const updated = await this.prisma.adminOwnership.update({
      where: { id: existing.id },
      data: {
        assignedAdminId: existing.assignedAdminId ?? actorAdminId,
        claimedAt: existing.claimedAt ?? now,
        operationalStatus: AdminOwnershipOperationalStatus.DONE,
        completedAt: now,
        metadata: nextMetadata as Prisma.InputJsonValue,
      },
    });

    await this.recordOperationalAudit({
      transactionId,
      actorAdminId,
      action: 'TRANSACTION_OPERATIONAL_CASE_RESOLVED',
      metadata: {
        operationalCaseId: updated.id,
        previousOperationalStatus: existing.operationalStatus,
        operationalStatus: updated.operationalStatus,
        resolutionCategory: dto.resolutionCategory,
        resolutionCode: dto.resolutionCode ?? null,
        resolutionSummary: dto.resolutionSummary,
      },
    });

    await this.recordOperationalTimeline({
      transactionId,
      actorAdminId,
      eventType: 'TRANSACTION_OPERATIONAL_CASE_RESOLVED',
      title: 'Transaction operational case resolved',
      message: dto.resolutionSummary,
      severity: AdminTimelineSeverity.SUCCESS,
      metadata: {
        operationalCaseId: updated.id,
        resolutionCategory: dto.resolutionCategory,
        resolutionCode: dto.resolutionCode ?? null,
      },
    });

    return this.mapOperationalCase(updated);
  }

  async reopenOperationalCase(
    transactionId: string,
    actorAdminId: string,
    dto: ReopenAdminTransactionOperationalCaseDto,
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
            createdFrom: 'admin_transaction_operations.reopen',
            latestActionCode: 'CASE_CREATED',
            latestNote: null,
          } as Prisma.InputJsonValue,
        },
      }));

    const now = new Date();
    const previousMetadata = this.asObject(existing.metadata);

    const nextMetadata = {
      ...previousMetadata,
      ...(dto.metadata ?? {}),
      operationalResolutionStatus:
        AdminTransactionOperationalResolutionStatus.REOPENED,
      operationalReopenedAt: now.toISOString(),
      operationalReopenedById: actorAdminId,
      operationalReopenReason: dto.reason,
      operationalReopenCode: dto.reopenCode ?? null,
      latestActionCode: 'OPERATIONAL_CASE_REOPENED',
      latestNote: dto.reason,
      lastUpdatedByAdminId: actorAdminId,
      lastUpdatedAt: now.toISOString(),
      previousOperationalStatus: existing.operationalStatus,
      currentOperationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
    };

    const updated = await this.prisma.adminOwnership.update({
      where: { id: existing.id },
      data: {
        assignedAdminId: existing.assignedAdminId ?? actorAdminId,
        claimedAt: existing.claimedAt ?? now,
        operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
        completedAt: null,
        releasedAt: null,
        metadata: nextMetadata as Prisma.InputJsonValue,
      },
    });

    await this.recordOperationalAudit({
      transactionId,
      actorAdminId,
      action: 'TRANSACTION_OPERATIONAL_CASE_REOPENED',
      metadata: {
        operationalCaseId: updated.id,
        previousOperationalStatus: existing.operationalStatus,
        operationalStatus: updated.operationalStatus,
        reopenReason: dto.reason,
        reopenCode: dto.reopenCode ?? null,
      },
    });

    await this.recordOperationalTimeline({
      transactionId,
      actorAdminId,
      eventType: 'TRANSACTION_OPERATIONAL_CASE_REOPENED',
      title: 'Transaction operational case reopened',
      message: dto.reason,
      severity: AdminTimelineSeverity.WARNING,
      metadata: {
        operationalCaseId: updated.id,
        reopenReason: dto.reason,
        reopenCode: dto.reopenCode ?? null,
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

  private async loadRows(): Promise<AdminTransactionOperationItemDto[]> {
    const [transactions, evidenceRows, activeRestrictions, operationalCases] =
      await Promise.all([
        this.prisma.transaction.findMany({
          orderBy: [{ updatedAt: 'desc' }],
          take: 500,
          include: {
            disputes: {
              orderBy: [{ createdAt: 'desc' }],
              take: 1,
              include: { resolution: true },
            },
            payout: true,
            refund: true,
            amlCase: true,
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
        this.prisma.adminOwnership.findMany({
          where: {
            objectType: AdminOwnershipObjectType.TRANSACTION,
          },
          orderBy: [{ updatedAt: 'desc' }],
          take: 1000,
        }),
      ]);

    return this.buildQueueItems({
      transactions,
      evidenceRows,
      activeRestrictions,
      operationalCases,
    });
  }

  private buildQueueItems(input: {
    transactions: any[];
    evidenceRows: EvidenceSignal[];
    activeRestrictions: Array<{ userId: string }>;
    operationalCases: Array<{
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
    }>;
  }): AdminTransactionOperationItemDto[] {
    const evidenceByTargetKey = this.groupEvidenceByTargetKey(
      input.evidenceRows,
    );
    const restrictedUserIds = new Set(
      input.activeRestrictions.map((item) => item.userId),
    );
    const operationalCasesByTransactionId = new Map(
      input.operationalCases.map((item) => [item.objectId, item]),
    );

    return input.transactions.map((tx) => {
      const latestDispute = tx.disputes?.[0] ?? null;
      const operationalCase =
        operationalCasesByTransactionId.get(tx.id) ?? null;

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

      const ageMinutes = this.minutesBetween(tx.createdAt, new Date());
      const lastUpdatedAgeMinutes = this.minutesBetween(tx.updatedAt, new Date());
      const disputeAgeMinutes = latestDispute
        ? this.minutesBetween(latestDispute.createdAt, new Date())
        : null;
      const payoutAgeMinutes = tx.payout?.updatedAt
        ? this.minutesBetween(tx.payout.updatedAt, new Date())
        : null;
      const refundAgeMinutes = tx.refund?.updatedAt
        ? this.minutesBetween(tx.refund.updatedAt, new Date())
        : null;
      const pendingEvidenceOldestAgeMinutes =
        pendingEvidence.length > 0
          ? Math.max(
              ...pendingEvidence.map((item) =>
                this.minutesBetween(item.createdAt, new Date()),
              ),
            )
          : null;
      const operationalCaseAgeMinutes = operationalCase
        ? this.minutesBetween(operationalCase.updatedAt, new Date())
        : null;

      const isStale =
        lastUpdatedAgeMinutes >
        AdminTransactionOperationsService.STALE_TRANSACTION_MINUTES;
      const isOverdue =
        Boolean(operationalCase?.slaDueAt) &&
        Boolean(operationalCase?.slaDueAt && operationalCase.slaDueAt < new Date());

      const escalationReasons = this.buildEscalationReasons({
        hasOpenDispute,
        disputeAgeMinutes,
        pendingEvidenceOldestAgeMinutes,
        hasPendingPayout,
        payoutAgeMinutes,
        hasPendingRefund,
        refundAgeMinutes,
        hasOperationalCase: Boolean(operationalCase),
        operationalCaseStatus: operationalCase?.operationalStatus ?? null,
        operationalCaseAgeMinutes,
        hasRejectedDeliveryProof,
        isOverdue,
        isStale,
      });

      const requiresEscalation = escalationReasons.length > 0;

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
        isStale,
        isOverdue,
        requiresEscalation,
      });

      const operationalSeverity = this.resolveSeverity({
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDisputeEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasRejectedDeliveryProof,
        hasPendingPayout,
        hasPendingRefund,
        hasActiveRestriction,
        requiresEscalation,
        isOverdue,
      });

      const recommendedAction = this.resolveRecommendedAction({
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasRejectedDeliveryProof,
        hasPendingPayout,
        hasPendingRefund,
        hasActiveRestriction,
        requiresEscalation,
      });

      const automation = this.buildAutomationReadiness({
        transactionStatus: tx.status,
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasRejectedDeliveryProof,
        hasPendingRefund,
        hasPendingPayout,
        hasActiveRestriction,
        requiresEscalation,
        isOverdue,
        isStale,
        amlCaseExists: Boolean(tx.amlCase),
      });

      const resolution = this.buildResolutionSuggestion({
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDisputeEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasRejectedDeliveryProof,
        hasPendingRefund,
        hasPendingPayout,
        hasActiveRestriction,
        requiresEscalation,
        amlCaseExists: Boolean(tx.amlCase),
        operationalCaseStatus: operationalCase?.operationalStatus ?? null,
        automationReadiness: automation.readiness,
      });

      const executionReadiness = this.buildExecutionReadiness({
        transactionStatus: tx.status,
        paymentStatus: tx.paymentStatus,
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasRejectedDeliveryProof,
        hasAcceptedDeliveryProof,
        hasPendingRefund,
        hasPendingPayout,
        hasActiveRestriction,
        requiresEscalation,
        amlCaseExists: Boolean(tx.amlCase),
        automationReadiness: automation.readiness,
        suggestedResolution: resolution.suggestedResolution,
      });

      const decisionMatrix = this.buildDecisionMatrix({
        transactionStatus: tx.status,
        paymentStatus: tx.paymentStatus,
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasRejectedDeliveryProof,
        hasPendingRefund,
        hasPendingPayout,
        hasActiveRestriction,
        requiresEscalation,
        isOverdue,
        amlCaseExists: Boolean(tx.amlCase),
        automationReadiness: automation.readiness,
        canAutoResolve: resolution.canAutoResolve,
      });

      const routing = this.buildOperationalRouting({
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasRejectedDeliveryProof,
        hasPendingRefund,
        hasPendingPayout,
        hasActiveRestriction,
        requiresEscalation,
        amlCaseExists: Boolean(tx.amlCase),
        operationalSeverity,
      });

      const ownership = this.buildOperationalOwnership({
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasRejectedDeliveryProof,
        hasPendingRefund,
        hasPendingPayout,
        hasActiveRestriction,
        requiresEscalation,
        amlCaseExists: Boolean(tx.amlCase),
        operationalSeverity,
      });

      const cockpit = this.buildOperationalCockpit({
        operationalSeverity,
        requiresEscalation,
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasPendingRefund,
        hasPendingPayout,
        hasActiveRestriction,
        isOverdue,
        automationConfidenceScore:
          automation.confidenceScore,
        automationRequiresHumanReview:
          automation.requiresHumanReview,
        routingEscalationRequired:
          routing.requiresImmediateAttention,
      });

      const requiresAdminAttention =
        operationalSeverity !== TransactionOperationalSeverity.LOW ||
        recommendedAction !== TransactionRecommendedAction.NO_ACTION_REQUIRED;

      const operationalCaseMetadata = this.asObject(operationalCase?.metadata);
      const operationalPriority = operationalCase
        ? this.extractPriority(operationalCaseMetadata)
        : null;

      const workflow = this.buildWorkflow({
        transactionStatus: tx.status,
        paymentStatus: tx.paymentStatus,
        hasOpenDispute,
        hasPendingEvidenceReview,
        hasPendingDisputeEvidenceReview,
        hasPendingDeliveryEvidenceReview,
        hasRejectedDeliveryProof,
        hasPendingRefund,
        hasPendingPayout,
        hasActiveRestriction,
        requiresEscalation,
        operationalCaseStatus: operationalCase?.operationalStatus ?? null,
        assignedAdminId: operationalCase?.assignedAdminId ?? null,
      });

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
        resolution,
        routing,
        ownership,
        workflow,
        decisionMatrix,
        cockpit,
        executionReadiness,
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
        hasOperationalCase: Boolean(operationalCase),
        operationalCaseStatus: operationalCase?.operationalStatus ?? null,
        assignedAdminId: operationalCase?.assignedAdminId ?? null,
        operationalPriority,
        ageMinutes,
        lastUpdatedAgeMinutes,
        disputeAgeMinutes,
        payoutAgeMinutes,
        refundAgeMinutes,
        pendingEvidenceOldestAgeMinutes,
        operationalCaseAgeMinutes,
        isStale,
        isOverdue,
        requiresEscalation,
        escalationReasons,
        requiresAdminAttention,
        operationalSeverity,
        recommendedAction,
        reasons,
        pendingEvidenceTargetKeys: pendingEvidence.map((item) =>
          this.targetKey(item.targetType, item.targetId),
        ),
        automation: {
          readiness: automation.readiness,
          confidenceScore: automation.confidenceScore,
          blockerCount: automation.blockers.length,
          candidateCount: automation.candidates.length,
          requiresHumanReview: automation.requiresHumanReview,
        },
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      };
    });
  }

  private applyFilters(
    items: AdminTransactionOperationItemDto[],
    query: AdminTransactionOperationsQueryDto,
  ): AdminTransactionOperationItemDto[] {
    return items.filter((item) => {
      if (
        query.transactionStatus &&
        item.transactionStatus !== query.transactionStatus
      ) {
        return false;
      }

      if (query.paymentStatus && item.paymentStatus !== query.paymentStatus) {
        return false;
      }

      if (
        query.operationalSeverity &&
        item.operationalSeverity !== query.operationalSeverity
      ) {
        return false;
      }

      if (
        query.recommendedAction &&
        item.recommendedAction !== query.recommendedAction
      ) {
        return false;
      }

      if (
        query.requiresAdminAttention !== undefined &&
        item.requiresAdminAttention !== query.requiresAdminAttention
      ) {
        return false;
      }

      if (
        query.requiresEscalation !== undefined &&
        item.requiresEscalation !== query.requiresEscalation
      ) {
        return false;
      }

      if (query.isOverdue !== undefined && item.isOverdue !== query.isOverdue) {
        return false;
      }

      if (query.isStale !== undefined && item.isStale !== query.isStale) {
        return false;
      }

      if (
        query.hasOperationalCase !== undefined &&
        item.hasOperationalCase !== query.hasOperationalCase
      ) {
        return false;
      }

      if (
        query.isOperationalCaseUnassigned !== undefined &&
        Boolean(item.hasOperationalCase && !item.assignedAdminId) !==
          query.isOperationalCaseUnassigned
      ) {
        return false;
      }

      if (
        query.hasOpenDispute !== undefined &&
        item.hasOpenDispute !== query.hasOpenDispute
      ) {
        return false;
      }

      if (
        query.hasPendingEvidenceReview !== undefined &&
        item.hasPendingEvidenceReview !== query.hasPendingEvidenceReview
      ) {
        return false;
      }

      if (
        query.hasPendingDisputeEvidenceReview !== undefined &&
        item.hasPendingDisputeEvidenceReview !==
          query.hasPendingDisputeEvidenceReview
      ) {
        return false;
      }

      if (
        query.hasPendingDeliveryEvidenceReview !== undefined &&
        item.hasPendingDeliveryEvidenceReview !==
          query.hasPendingDeliveryEvidenceReview
      ) {
        return false;
      }

      if (
        query.hasAcceptedDeliveryProof !== undefined &&
        item.hasAcceptedDeliveryProof !== query.hasAcceptedDeliveryProof
      ) {
        return false;
      }

      if (
        query.hasRejectedDeliveryProof !== undefined &&
        item.hasRejectedDeliveryProof !== query.hasRejectedDeliveryProof
      ) {
        return false;
      }

      if (
        query.hasPendingRefund !== undefined &&
        item.hasPendingRefund !== query.hasPendingRefund
      ) {
        return false;
      }

      if (
        query.hasPendingPayout !== undefined &&
        item.hasPendingPayout !== query.hasPendingPayout
      ) {
        return false;
      }

      if (
        query.hasActiveRestriction !== undefined &&
        item.hasActiveRestriction !== query.hasActiveRestriction
      ) {
        return false;
      }

      if (
        query.assignedAdminId &&
        item.assignedAdminId !== query.assignedAdminId
      ) {
        return false;
      }

      if (
        query.operationalCaseStatus &&
        item.operationalCaseStatus !== query.operationalCaseStatus
      ) {
        return false;
      }

      if (
        query.operationalPriority &&
        item.operationalPriority !== query.operationalPriority
      ) {
        return false;
      }

      if (query.q) {
        const needle = query.q.trim().toLowerCase();

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
          item.operationalCaseStatus ?? '',
          item.assignedAdminId ?? '',
          item.operationalPriority ?? '',
          ...item.reasons,
          ...item.escalationReasons,
          ...item.pendingEvidenceTargetKeys,
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(needle)) {
          return false;
        }
      }

      return true;
    });
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
        case AdminTransactionOperationsSortBy.AGE:
          compare = a.ageMinutes - b.ageMinutes;
          break;
        case AdminTransactionOperationsSortBy.STALE_AGE:
          compare = a.lastUpdatedAgeMinutes - b.lastUpdatedAgeMinutes;
          break;
        case AdminTransactionOperationsSortBy.ESCALATION:
          compare =
            Number(a.requiresEscalation) - Number(b.requiresEscalation);
          break;
        case AdminTransactionOperationsSortBy.UPDATED_AT:
        default:
          compare = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
      }

      return sortOrder === SortOrder.ASC ? compare : -compare;
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

  private buildEscalationReasons(input: {
    hasOpenDispute: boolean;
    disputeAgeMinutes: number | null;
    pendingEvidenceOldestAgeMinutes: number | null;
    hasPendingPayout: boolean;
    payoutAgeMinutes: number | null;
    hasPendingRefund: boolean;
    refundAgeMinutes: number | null;
    hasOperationalCase: boolean;
    operationalCaseStatus: AdminOwnershipOperationalStatus | null;
    operationalCaseAgeMinutes: number | null;
    hasRejectedDeliveryProof: boolean;
    isOverdue: boolean;
    isStale: boolean;
  }): string[] {
    const reasons: string[] = [];

    if (
      input.hasOpenDispute &&
      (input.disputeAgeMinutes ?? 0) >
        AdminTransactionOperationsService.OPEN_DISPUTE_ESCALATION_MINUTES
    ) {
      reasons.push('OPEN_DISPUTE_TOO_OLD');
    }

    if (
      (input.pendingEvidenceOldestAgeMinutes ?? 0) >
      AdminTransactionOperationsService.PENDING_EVIDENCE_ESCALATION_MINUTES
    ) {
      reasons.push('PENDING_EVIDENCE_TOO_OLD');
    }

    if (
      input.hasPendingPayout &&
      (input.payoutAgeMinutes ?? 0) >
        AdminTransactionOperationsService.PENDING_PAYOUT_ESCALATION_MINUTES
    ) {
      reasons.push('PENDING_PAYOUT_TOO_OLD');
    }

    if (
      input.hasPendingRefund &&
      (input.refundAgeMinutes ?? 0) >
        AdminTransactionOperationsService.PENDING_REFUND_ESCALATION_MINUTES
    ) {
      reasons.push('PENDING_REFUND_TOO_OLD');
    }

    if (
      input.hasOperationalCase &&
      input.operationalCaseStatus !== AdminOwnershipOperationalStatus.DONE &&
      input.operationalCaseStatus !==
        AdminOwnershipOperationalStatus.RELEASED &&
      (input.operationalCaseAgeMinutes ?? 0) >
        AdminTransactionOperationsService.OPERATIONAL_CASE_ESCALATION_MINUTES
    ) {
      reasons.push('OPERATIONAL_CASE_STALE');
    }

    if (input.hasRejectedDeliveryProof) {
      reasons.push('REJECTED_DELIVERY_PROOF');
    }

    if (input.isOverdue) {
      reasons.push('SLA_OVERDUE');
    }

    if (input.isStale) {
      reasons.push('STALE_TRANSACTION');
    }

    return reasons;
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
    isStale: boolean;
    isOverdue: boolean;
    requiresEscalation: boolean;
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

    if (input.isStale) {
      reasons.push('STALE_TRANSACTION');
    }

    if (input.isOverdue) {
      reasons.push('SLA_OVERDUE');
    }

    if (input.requiresEscalation) {
      reasons.push('REQUIRES_ESCALATION');
    }

    return reasons;
  }

  private resolveSeverity(input: {
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDisputeEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingPayout: boolean;
    hasPendingRefund: boolean;
    hasActiveRestriction: boolean;
    requiresEscalation: boolean;
    isOverdue: boolean;
  }): TransactionOperationalSeverity {
    if (
      input.requiresEscalation ||
      input.isOverdue ||
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
      input.hasActiveRestriction
    ) {
      return TransactionOperationalSeverity.MEDIUM;
    }

    return TransactionOperationalSeverity.LOW;
  }

  private resolveRecommendedAction(input: {
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingPayout: boolean;
    hasPendingRefund: boolean;
    hasActiveRestriction: boolean;
    requiresEscalation: boolean;
  }): TransactionRecommendedAction {
    if (input.requiresEscalation) {
      return TransactionRecommendedAction.ESCALATE_OPERATIONAL_CASE;
    }

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

    return TransactionRecommendedAction.NO_ACTION_REQUIRED;
  }

  private buildNextOperationalSteps(
    queueItem: AdminTransactionOperationItemDto,
  ): string[] {
    const steps: string[] = [];

    if (queueItem.requiresEscalation) {
      steps.push('Escalate this operational case to a senior admin or ops lead.');
    }

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

  private buildOperationalCockpit(input: {
    operationalSeverity: TransactionOperationalSeverity;
    requiresEscalation: boolean;
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasPendingRefund: boolean;
    hasPendingPayout: boolean;
    hasActiveRestriction: boolean;
    isOverdue: boolean;
    automationConfidenceScore: number;
    automationRequiresHumanReview: boolean;
    routingEscalationRequired: boolean;
  }): AdminTransactionOperationalCockpitDto {
    let globalOperationalScore = 100;

    const topOperationalSignals: string[] = [];
    const topOperationalBlockers: string[] = [];

    if (input.hasOpenDispute) {
      globalOperationalScore -= 25;
      topOperationalSignals.push('OPEN_DISPUTE');
    }

    if (input.hasPendingEvidenceReview) {
      globalOperationalScore -= 10;
      topOperationalSignals.push('PENDING_EVIDENCE');
    }

    if (input.hasPendingDeliveryEvidenceReview) {
      globalOperationalScore -= 10;
      topOperationalSignals.push('DELIVERY_REVIEW_REQUIRED');
    }

    if (input.hasPendingRefund) {
      globalOperationalScore -= 10;
      topOperationalSignals.push('PENDING_REFUND');
    }

    if (input.hasPendingPayout) {
      globalOperationalScore -= 10;
      topOperationalSignals.push('PENDING_PAYOUT');
    }

    if (input.hasActiveRestriction) {
      globalOperationalScore -= 20;
      topOperationalBlockers.push('ACTIVE_RESTRICTION');
    }

    if (input.isOverdue) {
      globalOperationalScore -= 20;
      topOperationalBlockers.push('SLA_OVERDUE');
    }

    if (input.requiresEscalation) {
      globalOperationalScore -= 25;
      topOperationalBlockers.push('ESCALATION_REQUIRED');
    }

    globalOperationalScore = Math.max(
      0,
      Math.min(100, globalOperationalScore),
    );

    let riskBand = TransactionOperationalRiskBand.LOW;

    if (globalOperationalScore < 80) {
      riskBand = TransactionOperationalRiskBand.MEDIUM;
    }

    if (globalOperationalScore < 60) {
      riskBand = TransactionOperationalRiskBand.HIGH;
    }

    if (globalOperationalScore < 35) {
      riskBand = TransactionOperationalRiskBand.CRITICAL;
    }

    let urgencyBand =
      TransactionOperationalUrgencyBand.ROUTINE;

    if (input.hasPendingEvidenceReview) {
      urgencyBand =
        TransactionOperationalUrgencyBand.PRIORITY;
    }

    if (
      input.requiresEscalation ||
      input.isOverdue
    ) {
      urgencyBand =
        TransactionOperationalUrgencyBand.URGENT;
    }

    if (
      input.routingEscalationRequired &&
      input.hasOpenDispute
    ) {
      urgencyBand =
        TransactionOperationalUrgencyBand.IMMEDIATE;
    }

    let humanAttentionLevel =
      TransactionHumanAttentionLevel.MINIMAL;

    if (input.hasPendingEvidenceReview) {
      humanAttentionLevel =
        TransactionHumanAttentionLevel.MODERATE;
    }

    if (
      input.hasOpenDispute ||
      input.hasActiveRestriction
    ) {
      humanAttentionLevel =
        TransactionHumanAttentionLevel.HIGH;
    }

    if (
      input.requiresEscalation ||
      input.automationRequiresHumanReview
    ) {
      humanAttentionLevel =
        TransactionHumanAttentionLevel.FULL_MANUAL;
    }

    let automationReadinessBand =
      TransactionAutomationReadinessBand.READY;

    if (input.automationConfidenceScore < 70) {
      automationReadinessBand =
        TransactionAutomationReadinessBand.PARTIAL;
    }

    if (
      input.automationRequiresHumanReview ||
      input.requiresEscalation
    ) {
      automationReadinessBand =
        TransactionAutomationReadinessBand.BLOCKED;
    }

    return {
      globalOperationalScore,
      riskBand,
      urgencyBand,
      humanAttentionLevel,
      automationReadinessBand,
      executiveAttentionRequired:
        input.requiresEscalation,
      operationalHealthSummary:
        globalOperationalScore >= 80
          ? 'Operationally healthy'
          : globalOperationalScore >= 60
            ? 'Operational attention required'
            : globalOperationalScore >= 35
              ? 'Operational risk elevated'
              : 'Critical operational attention required',
      topOperationalSignals,
      topOperationalBlockers,
    };
  }

  private buildOperationalOwnership(input: {
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingRefund: boolean;
    hasPendingPayout: boolean;
    hasActiveRestriction: boolean;
    requiresEscalation: boolean;
    amlCaseExists: boolean;
    operationalSeverity: TransactionOperationalSeverity;
  }): AdminTransactionOperationalOwnershipDto {
    const ownershipReasons: string[] = [];
    const supportingTeams: string[] = [];

    let recommendedPrimaryOwner =
      TransactionOperationalOwnershipProfile.GENERALIST;

    let recommendedSeniority =
      TransactionOperationalOwnershipSeniority.JUNIOR;

    if (input.hasOpenDispute) {
      recommendedPrimaryOwner =
        TransactionOperationalOwnershipProfile.DISPUTE_SPECIALIST;

      recommendedSeniority =
        TransactionOperationalOwnershipSeniority.CONFIRMED;

      ownershipReasons.push('OPEN_DISPUTE');
    }

    if (
      input.hasPendingDeliveryEvidenceReview ||
      input.hasRejectedDeliveryProof
    ) {
      recommendedPrimaryOwner =
        TransactionOperationalOwnershipProfile.DELIVERY_SPECIALIST;

      recommendedSeniority =
        TransactionOperationalOwnershipSeniority.CONFIRMED;

      ownershipReasons.push('DELIVERY_REVIEW_REQUIRED');
    }

    if (
      input.hasPendingRefund ||
      input.hasPendingPayout
    ) {
      recommendedPrimaryOwner =
        TransactionOperationalOwnershipProfile.FINANCIAL_OPERATIONS;

      recommendedSeniority =
        TransactionOperationalOwnershipSeniority.CONFIRMED;

      ownershipReasons.push('FINANCIAL_OPERATION_PENDING');
    }

    if (input.hasActiveRestriction) {
      supportingTeams.push('TRUST_AND_SAFETY');

      ownershipReasons.push('ACTIVE_RESTRICTION');
    }

    if (input.amlCaseExists) {
      recommendedPrimaryOwner =
        TransactionOperationalOwnershipProfile.COMPLIANCE_ANALYST;

      recommendedSeniority =
        TransactionOperationalOwnershipSeniority.SENIOR;

      supportingTeams.push('FINANCIAL_OPERATIONS');

      ownershipReasons.push('AML_CASE_ACTIVE');
    }

    if (
      input.operationalSeverity ===
      TransactionOperationalSeverity.HIGH
    ) {
      recommendedSeniority =
        TransactionOperationalOwnershipSeniority.SENIOR;

      ownershipReasons.push('HIGH_OPERATIONAL_SEVERITY');
    }

    if (input.requiresEscalation) {
      recommendedPrimaryOwner =
        TransactionOperationalOwnershipProfile.EXECUTIVE_REVIEWER;

      recommendedSeniority =
        TransactionOperationalOwnershipSeniority.LEAD;

      supportingTeams.push(
        'DISPUTE_OPERATIONS',
        'COMPLIANCE',
      );

      ownershipReasons.push('REQUIRES_ESCALATION');
    }

    const uniqueSupportingTeams = [...new Set(supportingTeams)];

    return {
      recommendedPrimaryOwner,
      recommendedSeniority,
      supportingTeams: uniqueSupportingTeams,
      requiresCrossTeamCoordination:
        uniqueSupportingTeams.length > 0,
      requiresSeniorValidation:
        recommendedSeniority ===
          TransactionOperationalOwnershipSeniority.SENIOR ||
        recommendedSeniority ===
          TransactionOperationalOwnershipSeniority.LEAD,
      ownershipReasons,
    };
  }

  private buildOperationalRouting(input: {
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingRefund: boolean;
    hasPendingPayout: boolean;
    hasActiveRestriction: boolean;
    requiresEscalation: boolean;
    amlCaseExists: boolean;
    operationalSeverity: TransactionOperationalSeverity;
  }): AdminTransactionOperationalRoutingDto {
    const reasons: string[] = [];

    let recommendedTeam =
      TransactionOperationalRoutingTeam.GENERAL_OPERATIONS;

    let urgency = TransactionOperationalRoutingUrgency.LOW;

    if (input.amlCaseExists) {
      recommendedTeam = TransactionOperationalRoutingTeam.COMPLIANCE;

      urgency = TransactionOperationalRoutingUrgency.CRITICAL;

      reasons.push('AML_CASE_ACTIVE');
    } else if (
      input.hasOpenDispute ||
      input.hasPendingEvidenceReview
    ) {
      recommendedTeam =
        TransactionOperationalRoutingTeam.DISPUTE_OPERATIONS;

      urgency =
        input.operationalSeverity ===
        TransactionOperationalSeverity.HIGH
          ? TransactionOperationalRoutingUrgency.HIGH
          : TransactionOperationalRoutingUrgency.MEDIUM;

      reasons.push('OPEN_DISPUTE_OR_EVIDENCE_REVIEW');
    } else if (
      input.hasPendingDeliveryEvidenceReview ||
      input.hasRejectedDeliveryProof
    ) {
      recommendedTeam =
        TransactionOperationalRoutingTeam.DELIVERY_OPERATIONS;

      urgency =
        input.hasRejectedDeliveryProof
          ? TransactionOperationalRoutingUrgency.HIGH
          : TransactionOperationalRoutingUrgency.MEDIUM;

      reasons.push('DELIVERY_PROOF_REVIEW_REQUIRED');
    } else if (
      input.hasPendingRefund ||
      input.hasPendingPayout
    ) {
      recommendedTeam =
        TransactionOperationalRoutingTeam.FINANCIAL_OPERATIONS;

      urgency = TransactionOperationalRoutingUrgency.MEDIUM;

      reasons.push('FINANCIAL_OPERATION_PENDING');
    } else if (input.hasActiveRestriction) {
      recommendedTeam =
        TransactionOperationalRoutingTeam.TRUST_AND_SAFETY;

      urgency = TransactionOperationalRoutingUrgency.HIGH;

      reasons.push('ACTIVE_USER_RESTRICTION');
    }

    if (input.requiresEscalation) {
      recommendedTeam =
        TransactionOperationalRoutingTeam.EXECUTIVE_REVIEW;

      urgency = TransactionOperationalRoutingUrgency.CRITICAL;

      reasons.push('REQUIRES_ESCALATION');
    }

    const requiresImmediateAttention =
      urgency === TransactionOperationalRoutingUrgency.CRITICAL ||
      urgency === TransactionOperationalRoutingUrgency.HIGH;

    return {
      recommendedTeam,
      urgency,
      requiresImmediateAttention,
      routingReasons: reasons,
    };
  }

  private buildDecisionMatrix(input: {
    transactionStatus: TransactionStatus;
    paymentStatus: PaymentStatus;
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingRefund: boolean;
    hasPendingPayout: boolean;
    hasActiveRestriction: boolean;
    requiresEscalation: boolean;
    isOverdue: boolean;
    amlCaseExists: boolean;
    automationReadiness: TransactionAutomationReadiness;
    canAutoResolve: boolean;
  }): AdminTransactionOperationalDecisionMatrixDto {
    const releaseFundsBlockers = this.buildDecisionBlockers(input, {
      requirePayment: true,
      requireDelivery: true,
      blockDispute: true,
      blockEvidence: true,
      blockRestriction: true,
      blockAml: true,
      blockRefund: true,
    });

    const refundBlockers = this.buildDecisionBlockers(input, {
      requirePayment: true,
      requireDelivery: false,
      blockDispute: false,
      blockEvidence: true,
      blockRestriction: true,
      blockAml: true,
      blockRefund: false,
    });

    const closeCaseBlockers = this.buildDecisionBlockers(input, {
      requirePayment: false,
      requireDelivery: false,
      blockDispute: true,
      blockEvidence: true,
      blockRestriction: true,
      blockAml: true,
      blockRefund: true,
    });

    const evidenceBlockers: TransactionOperationalDecisionBlockerCode[] = [];

    if (
      !input.hasPendingEvidenceReview &&
      !input.hasPendingDeliveryEvidenceReview &&
      !input.hasRejectedDeliveryProof
    ) {
      evidenceBlockers.push(
        TransactionOperationalDecisionBlockerCode.PENDING_EVIDENCE_REVIEW,
      );
    }

    const rules: TransactionOperationalDecisionRuleDto[] = [
      this.decisionRule({
        action: TransactionOperationalDecisionAction.RELEASE_FUNDS,
        blockers: releaseFundsBlockers,
        requiresHumanApproval:
          input.hasRejectedDeliveryProof ||
          input.hasActiveRestriction ||
          input.amlCaseExists,
        allowedReason:
          'Funds release is allowed because payment and delivery are confirmed and no blocking risk signal remains.',
        blockedReason:
          'Funds release is blocked by transaction, evidence, dispute or risk state.',
      }),

      this.decisionRule({
        action: TransactionOperationalDecisionAction.EXECUTE_REFUND,
        blockers: refundBlockers,
        requiresHumanApproval:
          input.hasActiveRestriction ||
          input.amlCaseExists ||
          input.hasOpenDispute,
        allowedReason:
          'Refund execution is operationally allowed by the current safety matrix.',
        blockedReason:
          'Refund execution is blocked by evidence, risk or payment state.',
      }),

      this.decisionRule({
        action: TransactionOperationalDecisionAction.CLOSE_OPERATIONAL_CASE,
        blockers: closeCaseBlockers,
        requiresHumanApproval: false,
        allowedReason:
          'Operational case can be closed because no blocking operational signal remains.',
        blockedReason:
          'Operational case closure is blocked by unresolved operational signals.',
      }),

      {
        action: TransactionOperationalDecisionAction.ESCALATE_OPERATIONAL_CASE,
        status: input.requiresEscalation
          ? TransactionOperationalDecisionStatus.REQUIRED
          : TransactionOperationalDecisionStatus.NOT_REQUIRED,
        allowed: input.requiresEscalation,
        requiresHumanApproval: true,
        blockers: input.requiresEscalation
          ? []
          : [TransactionOperationalDecisionBlockerCode.REQUIRES_ESCALATION],
        reasons: input.requiresEscalation
          ? ['Escalation is required because escalation signals are present.']
          : ['Escalation is not required because no escalation signal is present.'],
      },

      this.decisionRule({
        action: TransactionOperationalDecisionAction.REQUEST_MORE_EVIDENCE,
        blockers: evidenceBlockers,
        requiresHumanApproval: true,
        allowedReason:
          'More evidence can be requested because evidence or delivery proof still needs attention.',
        blockedReason:
          'More evidence is not required by the current operational state.',
      }),

      {
        action: TransactionOperationalDecisionAction.MARK_READY_FOR_AUTOMATION,
        status:
          input.automationReadiness === TransactionAutomationReadiness.READY &&
          input.canAutoResolve
            ? TransactionOperationalDecisionStatus.ALLOWED
            : TransactionOperationalDecisionStatus.BLOCKED,
        allowed:
          input.automationReadiness === TransactionAutomationReadiness.READY &&
          input.canAutoResolve,
        requiresHumanApproval: false,
        blockers:
          input.automationReadiness === TransactionAutomationReadiness.READY &&
          input.canAutoResolve
            ? []
            : [TransactionOperationalDecisionBlockerCode.REQUIRES_ESCALATION],
        reasons:
          input.automationReadiness === TransactionAutomationReadiness.READY &&
          input.canAutoResolve
            ? ['Transaction is safe to progress toward future automation.']
            : ['Transaction is not safe for automation readiness yet.'],
      },
    ];

    const hasBlockingDecision = rules.some(
      (rule) => rule.status === TransactionOperationalDecisionStatus.BLOCKED,
    );

    const hasRequiredEscalation = rules.some(
      (rule) =>
        rule.action ===
          TransactionOperationalDecisionAction.ESCALATE_OPERATIONAL_CASE &&
        rule.status === TransactionOperationalDecisionStatus.REQUIRED,
    );

    const safeToAutoProgress = rules.some(
      (rule) =>
        rule.action ===
          TransactionOperationalDecisionAction.MARK_READY_FOR_AUTOMATION &&
        rule.allowed,
    );

    return {
      hasBlockingDecision,
      hasRequiredEscalation,
      safeToAutoProgress,
      rules,
    };
  }

  private buildDecisionBlockers(
    input: {
      transactionStatus: TransactionStatus;
      paymentStatus: PaymentStatus;
      hasOpenDispute: boolean;
      hasPendingEvidenceReview: boolean;
      hasPendingDeliveryEvidenceReview: boolean;
      hasRejectedDeliveryProof: boolean;
      hasPendingRefund: boolean;
      hasPendingPayout: boolean;
      hasActiveRestriction: boolean;
      requiresEscalation: boolean;
      isOverdue: boolean;
      amlCaseExists: boolean;
    },
    options: {
      requirePayment: boolean;
      requireDelivery: boolean;
      blockDispute: boolean;
      blockEvidence: boolean;
      blockRestriction: boolean;
      blockAml: boolean;
      blockRefund: boolean;
    },
  ): TransactionOperationalDecisionBlockerCode[] {
    const blockers: TransactionOperationalDecisionBlockerCode[] = [];

    if (options.requirePayment && input.paymentStatus !== PaymentStatus.SUCCESS) {
      blockers.push(
        TransactionOperationalDecisionBlockerCode.PAYMENT_NOT_CONFIRMED,
      );
    }

    if (
      options.requireDelivery &&
      input.transactionStatus !== TransactionStatus.DELIVERED
    ) {
      blockers.push(
        TransactionOperationalDecisionBlockerCode.DELIVERY_NOT_CONFIRMED,
      );
    }

    if (options.blockDispute && input.hasOpenDispute) {
      blockers.push(TransactionOperationalDecisionBlockerCode.OPEN_DISPUTE);
    }

    if (options.blockEvidence && input.hasPendingEvidenceReview) {
      blockers.push(
        TransactionOperationalDecisionBlockerCode.PENDING_EVIDENCE_REVIEW,
      );
    }

    if (options.blockEvidence && input.hasPendingDeliveryEvidenceReview) {
      blockers.push(
        TransactionOperationalDecisionBlockerCode.PENDING_DELIVERY_EVIDENCE_REVIEW,
      );
    }

    if (options.blockEvidence && input.hasRejectedDeliveryProof) {
      blockers.push(
        TransactionOperationalDecisionBlockerCode.REJECTED_DELIVERY_PROOF,
      );
    }

    if (options.blockRestriction && input.hasActiveRestriction) {
      blockers.push(
        TransactionOperationalDecisionBlockerCode.ACTIVE_USER_RESTRICTION,
      );
    }

    if (options.blockAml && input.amlCaseExists) {
      blockers.push(TransactionOperationalDecisionBlockerCode.AML_CASE_ACTIVE);
    }

    if (options.blockRefund && input.hasPendingRefund) {
      blockers.push(TransactionOperationalDecisionBlockerCode.PENDING_REFUND);
    }

    if (input.hasPendingPayout) {
      blockers.push(TransactionOperationalDecisionBlockerCode.PENDING_PAYOUT);
    }

    if (input.isOverdue) {
      blockers.push(TransactionOperationalDecisionBlockerCode.SLA_OVERDUE);
    }

    if (input.requiresEscalation) {
      blockers.push(
        TransactionOperationalDecisionBlockerCode.REQUIRES_ESCALATION,
      );
    }

    return blockers;
  }

  private decisionRule(input: {
    action: TransactionOperationalDecisionAction;
    blockers: TransactionOperationalDecisionBlockerCode[];
    requiresHumanApproval: boolean;
    allowedReason: string;
    blockedReason: string;
  }): TransactionOperationalDecisionRuleDto {
    const allowed = input.blockers.length === 0;

    return {
      action: input.action,
      status: allowed
        ? TransactionOperationalDecisionStatus.ALLOWED
        : TransactionOperationalDecisionStatus.BLOCKED,
      allowed,
      requiresHumanApproval: input.requiresHumanApproval,
      blockers: input.blockers,
      reasons: [allowed ? input.allowedReason : input.blockedReason],
    };
  }

  private buildExecutionReadiness(input: {
    transactionStatus: TransactionStatus;
    paymentStatus: PaymentStatus;
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasRejectedDeliveryProof: boolean;
    hasAcceptedDeliveryProof: boolean;
    hasPendingRefund: boolean;
    hasPendingPayout: boolean;
    hasActiveRestriction: boolean;
    requiresEscalation: boolean;
    amlCaseExists: boolean;
    automationReadiness: TransactionAutomationReadiness;
    suggestedResolution: TransactionOperationalSuggestedResolution;
  }): AdminTransactionOperationalExecutionReadinessDto {
    const actions: TransactionOperationalExecutableActionReadinessDto[] = [
      this.actionReadiness({
        action: TransactionOperationalExecutableAction.REVIEW_DISPUTE,
        isExecutable: input.hasOpenDispute,
        requiresHumanApproval: true,
        blockers: input.hasOpenDispute
          ? []
          : [
              this.executionBlocker(
                'NO_OPEN_DISPUTE',
                TransactionOperationalExecutionBlockerSeverity.LOW,
                'There is no open dispute to review.',
              ),
            ],
        prerequisites: [
          this.prerequisite(
            'OPEN_DISPUTE',
            'Open dispute exists',
            input.hasOpenDispute,
          ),
        ],
        reason: input.hasOpenDispute
          ? 'Open dispute can be reviewed by an admin.'
          : 'Dispute review is not applicable without an open dispute.',
      }),

      this.actionReadiness({
        action: TransactionOperationalExecutableAction.REVIEW_EVIDENCE,
        isExecutable: input.hasPendingEvidenceReview,
        requiresHumanApproval: true,
        blockers: input.hasPendingEvidenceReview
          ? []
          : [
              this.executionBlocker(
                'NO_PENDING_EVIDENCE',
                TransactionOperationalExecutionBlockerSeverity.LOW,
                'There is no pending evidence to review.',
              ),
            ],
        prerequisites: [
          this.prerequisite(
            'PENDING_EVIDENCE',
            'Pending evidence exists',
            input.hasPendingEvidenceReview,
          ),
        ],
        reason: input.hasPendingEvidenceReview
          ? 'Pending evidence can be reviewed.'
          : 'Evidence review is not currently required.',
      }),

      this.actionReadiness({
        action: TransactionOperationalExecutableAction.REVIEW_DELIVERY_PROOF,
        isExecutable:
          input.hasPendingDeliveryEvidenceReview ||
          input.hasRejectedDeliveryProof,
        requiresHumanApproval: true,
        blockers:
          input.hasPendingDeliveryEvidenceReview ||
          input.hasRejectedDeliveryProof
            ? []
            : [
                this.executionBlocker(
                  'NO_DELIVERY_PROOF_REVIEW_NEEDED',
                  TransactionOperationalExecutionBlockerSeverity.LOW,
                  'No delivery proof currently requires review.',
                ),
              ],
        prerequisites: [
          this.prerequisite(
            'DELIVERY_PROOF_ATTENTION',
            'Delivery proof needs attention',
            input.hasPendingDeliveryEvidenceReview ||
              input.hasRejectedDeliveryProof,
          ),
        ],
        reason:
          input.hasPendingDeliveryEvidenceReview ||
          input.hasRejectedDeliveryProof
            ? 'Delivery proof requires admin validation.'
            : 'Delivery proof review is not currently required.',
      }),

      this.actionReadiness({
        action: TransactionOperationalExecutableAction.ESCALATE_OPERATIONAL_CASE,
        isExecutable: input.requiresEscalation,
        requiresHumanApproval: true,
        blockers: input.requiresEscalation
          ? []
          : [
              this.executionBlocker(
                'NO_ESCALATION_SIGNAL',
                TransactionOperationalExecutionBlockerSeverity.LOW,
                'No escalation signal is currently present.',
              ),
            ],
        prerequisites: [
          this.prerequisite(
            'ESCALATION_SIGNAL',
            'Escalation signal exists',
            input.requiresEscalation,
          ),
        ],
        reason: input.requiresEscalation
          ? 'Escalation can be executed because escalation signals are present.'
          : 'Escalation is not currently required.',
      }),

      this.actionReadiness({
        action: TransactionOperationalExecutableAction.MONITOR_PAYOUT,
        isExecutable: input.hasPendingPayout,
        requiresHumanApproval: false,
        blockers: input.hasPendingPayout
          ? []
          : [
              this.executionBlocker(
                'NO_PENDING_PAYOUT',
                TransactionOperationalExecutionBlockerSeverity.LOW,
                'There is no pending payout to monitor.',
              ),
            ],
        prerequisites: [
          this.prerequisite(
            'PENDING_PAYOUT',
            'Pending payout exists',
            input.hasPendingPayout,
          ),
        ],
        reason: input.hasPendingPayout
          ? 'Payout monitoring is executable.'
          : 'Payout monitoring is not applicable.',
      }),

      this.actionReadiness({
        action: TransactionOperationalExecutableAction.MONITOR_REFUND,
        isExecutable: input.hasPendingRefund,
        requiresHumanApproval: false,
        blockers: input.hasPendingRefund
          ? []
          : [
              this.executionBlocker(
                'NO_PENDING_REFUND',
                TransactionOperationalExecutionBlockerSeverity.LOW,
                'There is no pending refund to monitor.',
              ),
            ],
        prerequisites: [
          this.prerequisite(
            'PENDING_REFUND',
            'Pending refund exists',
            input.hasPendingRefund,
          ),
        ],
        reason: input.hasPendingRefund
          ? 'Refund monitoring is executable.'
          : 'Refund monitoring is not applicable.',
      }),

      this.actionReadiness({
        action: TransactionOperationalExecutableAction.RELEASE_FUNDS,
        isExecutable:
          input.paymentStatus === PaymentStatus.SUCCESS &&
          input.transactionStatus === TransactionStatus.DELIVERED &&
          !input.hasOpenDispute &&
          !input.hasPendingEvidenceReview &&
          !input.hasRejectedDeliveryProof &&
          !input.hasPendingRefund &&
          !input.hasActiveRestriction &&
          !input.amlCaseExists,
        requiresHumanApproval:
          input.hasRejectedDeliveryProof ||
          input.hasActiveRestriction ||
          input.amlCaseExists,
        blockers: [
          ...(input.paymentStatus !== PaymentStatus.SUCCESS
            ? [
                this.executionBlocker(
                  'PAYMENT_NOT_CONFIRMED_BLOCKS_RELEASE',
                  TransactionOperationalExecutionBlockerSeverity.HIGH,
                  'Funds cannot be released before payment confirmation.',
                ),
              ]
            : []),
          ...(input.transactionStatus !== TransactionStatus.DELIVERED
            ? [
                this.executionBlocker(
                  'DELIVERY_NOT_CONFIRMED_BLOCKS_RELEASE',
                  TransactionOperationalExecutionBlockerSeverity.HIGH,
                  'Funds cannot be released before delivery is confirmed.',
                ),
              ]
            : []),
          ...(input.hasOpenDispute
            ? [
                this.executionBlocker(
                  'OPEN_DISPUTE_BLOCKS_RELEASE',
                  TransactionOperationalExecutionBlockerSeverity.HIGH,
                  'Funds cannot be released while a dispute is open.',
                ),
              ]
            : []),
          ...(input.hasRejectedDeliveryProof
            ? [
                this.executionBlocker(
                  'REJECTED_DELIVERY_PROOF_BLOCKS_RELEASE',
                  TransactionOperationalExecutionBlockerSeverity.HIGH,
                  'Rejected delivery proof blocks safe release.',
                ),
              ]
            : []),
          ...(input.hasActiveRestriction
            ? [
                this.executionBlocker(
                  'ACTIVE_RESTRICTION_BLOCKS_RELEASE',
                  TransactionOperationalExecutionBlockerSeverity.HIGH,
                  'Active user restriction requires manual review before release.',
                ),
              ]
            : []),
          ...(input.amlCaseExists
            ? [
                this.executionBlocker(
                  'AML_CASE_BLOCKS_RELEASE',
                  TransactionOperationalExecutionBlockerSeverity.HIGH,
                  'AML case blocks automatic release.',
                ),
              ]
            : []),
        ],
        prerequisites: [
          this.prerequisite(
            'PAYMENT_CONFIRMED',
            'Payment confirmed',
            input.paymentStatus === PaymentStatus.SUCCESS,
          ),
          this.prerequisite(
            'DELIVERY_CONFIRMED',
            'Delivery confirmed',
            input.transactionStatus === TransactionStatus.DELIVERED,
          ),
          this.prerequisite(
            'NO_OPEN_DISPUTE',
            'No open dispute',
            !input.hasOpenDispute,
          ),
          this.prerequisite(
            'NO_AML_CASE',
            'No AML case',
            !input.amlCaseExists,
          ),
        ],
        reason: 'Funds release requires confirmed payment, confirmed delivery and no blocking risk signal.',
      }),

      this.actionReadiness({
        action: TransactionOperationalExecutableAction.CLOSE_OPERATIONAL_CASE,
        isExecutable:
          input.suggestedResolution ===
            TransactionOperationalSuggestedResolution.CLOSE_OPERATIONAL_CASE &&
          input.automationReadiness === TransactionAutomationReadiness.READY,
        requiresHumanApproval: false,
        blockers:
          input.suggestedResolution ===
            TransactionOperationalSuggestedResolution.CLOSE_OPERATIONAL_CASE
            ? []
            : [
                this.executionBlocker(
                  'CASE_NOT_READY_FOR_CLOSURE',
                  TransactionOperationalExecutionBlockerSeverity.MEDIUM,
                  'Operational case is not ready for closure.',
                ),
              ],
        prerequisites: [
          this.prerequisite(
            'SAFE_RESOLUTION_SUGGESTED',
            'Close operational case is suggested',
            input.suggestedResolution ===
              TransactionOperationalSuggestedResolution.CLOSE_OPERATIONAL_CASE,
          ),
          this.prerequisite(
            'AUTOMATION_READY',
            'Automation readiness is ready',
            input.automationReadiness === TransactionAutomationReadiness.READY,
          ),
        ],
        reason: 'Operational case can be closed only when no blocking operational signal remains.',
      }),
    ];

    const executableActionCount = actions.filter(
      (action) => action.isExecutable,
    ).length;
    const blockedActionCount = actions.filter(
      (action) => !action.isExecutable,
    ).length;
    const humanApprovalRequiredCount = actions.filter(
      (action) => action.requiresHumanApproval,
    ).length;

    return {
      hasExecutableAction: executableActionCount > 0,
      executableActionCount,
      blockedActionCount,
      humanApprovalRequiredCount,
      overallConfidence: this.resolveExecutionConfidence(actions),
      actions,
    };
  }

  private actionReadiness(input: {
    action: TransactionOperationalExecutableAction;
    isExecutable: boolean;
    requiresHumanApproval: boolean;
    blockers: TransactionOperationalExecutableActionReadinessDto['blockers'];
    prerequisites: TransactionOperationalExecutableActionReadinessDto['prerequisites'];
    reason: string;
  }): TransactionOperationalExecutableActionReadinessDto {
    return {
      action: input.action,
      isExecutable: input.isExecutable,
      requiresHumanApproval: input.requiresHumanApproval,
      confidence: this.resolveActionConfidence(input.blockers),
      blockers: input.blockers,
      prerequisites: input.prerequisites,
      reason: input.reason,
    };
  }

  private executionBlocker(
    code: string,
    severity: TransactionOperationalExecutionBlockerSeverity,
    message: string,
  ) {
    return {
      code,
      severity,
      message,
    };
  }

  private prerequisite(
    code: string,
    label: string,
    isMet: boolean,
  ) {
    return {
      code,
      label,
      status: isMet
        ? TransactionOperationalExecutionPrerequisiteStatus.MET
        : TransactionOperationalExecutionPrerequisiteStatus.MISSING,
    };
  }

  private resolveActionConfidence(
    blockers: TransactionOperationalExecutableActionReadinessDto['blockers'],
  ): TransactionOperationalExecutionConfidence {
    if (
      blockers.some(
        (blocker) =>
          blocker.severity ===
          TransactionOperationalExecutionBlockerSeverity.HIGH,
      )
    ) {
      return TransactionOperationalExecutionConfidence.LOW;
    }

    if (blockers.length > 0) {
      return TransactionOperationalExecutionConfidence.MEDIUM;
    }

    return TransactionOperationalExecutionConfidence.HIGH;
  }

  private resolveExecutionConfidence(
    actions: TransactionOperationalExecutableActionReadinessDto[],
  ): TransactionOperationalExecutionConfidence {
    if (
      actions.some(
        (action) =>
          action.isExecutable &&
          action.confidence === TransactionOperationalExecutionConfidence.HIGH,
      )
    ) {
      return TransactionOperationalExecutionConfidence.HIGH;
    }

    if (actions.some((action) => action.isExecutable)) {
      return TransactionOperationalExecutionConfidence.MEDIUM;
    }

    return TransactionOperationalExecutionConfidence.LOW;
  }

  private buildResolutionSuggestion(input: {
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDisputeEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingRefund: boolean;
    hasPendingPayout: boolean;
    hasActiveRestriction: boolean;
    requiresEscalation: boolean;
    amlCaseExists: boolean;
    operationalCaseStatus: AdminOwnershipOperationalStatus | null;
    automationReadiness: TransactionAutomationReadiness;
  }): AdminTransactionOperationalResolutionDto {
    const resolutionBlockers: TransactionOperationalResolutionBlockerCode[] = [];
    const rationale: string[] = [];

    if (input.hasOpenDispute) {
      resolutionBlockers.push(TransactionOperationalResolutionBlockerCode.OPEN_DISPUTE);
      rationale.push('An open dispute requires admin review before operational closure.');
    }

    if (input.hasPendingEvidenceReview) {
      resolutionBlockers.push(
        TransactionOperationalResolutionBlockerCode.PENDING_EVIDENCE_REVIEW,
      );
      rationale.push('Evidence attachments are still pending review.');
    }

    if (input.hasPendingDeliveryEvidenceReview) {
      resolutionBlockers.push(
        TransactionOperationalResolutionBlockerCode.PENDING_DELIVERY_EVIDENCE_REVIEW,
      );
      rationale.push('Delivery proof still requires validation.');
    }

    if (input.hasRejectedDeliveryProof) {
      resolutionBlockers.push(
        TransactionOperationalResolutionBlockerCode.REJECTED_DELIVERY_PROOF,
      );
      rationale.push('Rejected delivery proof blocks safe operational resolution.');
    }

    if (input.hasActiveRestriction) {
      resolutionBlockers.push(
        TransactionOperationalResolutionBlockerCode.ACTIVE_USER_RESTRICTION,
      );
      rationale.push('An active sender/traveler restriction requires human review.');
    }

    if (input.amlCaseExists) {
      resolutionBlockers.push(TransactionOperationalResolutionBlockerCode.AML_CASE_ACTIVE);
      rationale.push('AML case presence blocks automatic operational resolution.');
    }

    if (input.hasPendingPayout) {
      resolutionBlockers.push(TransactionOperationalResolutionBlockerCode.PENDING_PAYOUT);
      rationale.push('Pending payout requires monitoring before closure.');
    }

    if (input.hasPendingRefund) {
      resolutionBlockers.push(TransactionOperationalResolutionBlockerCode.PENDING_REFUND);
      rationale.push('Pending refund requires monitoring before closure.');
    }

    if (input.requiresEscalation) {
      resolutionBlockers.push(
        TransactionOperationalResolutionBlockerCode.SLA_ESCALATION_REQUIRED,
      );
      rationale.push('Escalation signals require senior operations review.');
    }

    let suggestedResolution =
      TransactionOperationalSuggestedResolution.NO_ACTION_REQUIRED;

    if (input.requiresEscalation) {
      suggestedResolution =
        TransactionOperationalSuggestedResolution.ESCALATE_TO_SENIOR_REVIEW;
    } else if (input.amlCaseExists) {
      suggestedResolution =
        TransactionOperationalSuggestedResolution.HOLD_FOR_AML_REVIEW;
    } else if (input.hasActiveRestriction) {
      suggestedResolution =
        TransactionOperationalSuggestedResolution.HOLD_FOR_RESTRICTION_REVIEW;
    } else if (input.hasOpenDispute) {
      suggestedResolution = TransactionOperationalSuggestedResolution.REVIEW_DISPUTE;
    } else if (
      input.hasPendingDisputeEvidenceReview ||
      input.hasPendingEvidenceReview
    ) {
      suggestedResolution = TransactionOperationalSuggestedResolution.REVIEW_EVIDENCE;
    } else if (
      input.hasPendingDeliveryEvidenceReview ||
      input.hasRejectedDeliveryProof
    ) {
      suggestedResolution =
        TransactionOperationalSuggestedResolution.REQUEST_DELIVERY_PROOF;
    } else if (input.hasPendingPayout) {
      suggestedResolution = TransactionOperationalSuggestedResolution.MONITOR_PAYOUT;
    } else if (input.hasPendingRefund) {
      suggestedResolution = TransactionOperationalSuggestedResolution.MONITOR_REFUND;
    } else if (
      input.operationalCaseStatus === AdminOwnershipOperationalStatus.DONE ||
      input.automationReadiness === TransactionAutomationReadiness.READY
    ) {
      suggestedResolution =
        TransactionOperationalSuggestedResolution.CLOSE_OPERATIONAL_CASE;
      rationale.push('No blocking operational signal remains.');
    }

    const resolutionConfidenceScore = Math.max(
      0,
      Math.min(100, 100 - resolutionBlockers.length * 12),
    );

    const requiresSeniorApproval =
      input.requiresEscalation || resolutionBlockers.length >= 3;

    const requiresHumanReview =
      resolutionBlockers.length > 0 ||
      suggestedResolution !==
        TransactionOperationalSuggestedResolution.CLOSE_OPERATIONAL_CASE;

    const canAutoResolve =
      resolutionBlockers.length === 0 &&
      input.automationReadiness === TransactionAutomationReadiness.READY &&
      suggestedResolution ===
        TransactionOperationalSuggestedResolution.CLOSE_OPERATIONAL_CASE;

    if (rationale.length === 0) {
      rationale.push('No major operational blocker detected.');
    }

    return {
      suggestedResolution,
      resolutionConfidenceScore,
      canAutoResolve,
      requiresSeniorApproval,
      requiresHumanReview,
      resolutionBlockers,
      rationale,
    };
  }

  private buildAutomationReadiness(input: {
    transactionStatus: TransactionStatus;
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingRefund: boolean;
    hasPendingPayout: boolean;
    hasActiveRestriction: boolean;
    requiresEscalation: boolean;
    isOverdue: boolean;
    isStale: boolean;
    amlCaseExists: boolean;
  }): AdminTransactionOperationalAutomationDto {
    const blockers: TransactionAutomationBlockerCode[] = [];

    if (input.hasOpenDispute) {
      blockers.push(TransactionAutomationBlockerCode.OPEN_DISPUTE);
    }

    if (input.amlCaseExists) {
      blockers.push(TransactionAutomationBlockerCode.AML_ACTIVE);
    }

    if (input.hasActiveRestriction) {
      blockers.push(
        TransactionAutomationBlockerCode.ACTIVE_RESTRICTION,
      );
    }

    if (input.hasRejectedDeliveryProof) {
      blockers.push(
        TransactionAutomationBlockerCode.REJECTED_DELIVERY_PROOF,
      );
    }

    if (input.hasPendingEvidenceReview) {
      blockers.push(
        TransactionAutomationBlockerCode.PENDING_EVIDENCE_REVIEW,
      );
    }

    if (input.hasPendingRefund) {
      blockers.push(TransactionAutomationBlockerCode.PENDING_REFUND);
    }

    if (input.hasPendingPayout) {
      blockers.push(TransactionAutomationBlockerCode.PENDING_PAYOUT);
    }

    if (input.isStale) {
      blockers.push(TransactionAutomationBlockerCode.STALE_TRANSACTION);
    }

    if (input.isOverdue) {
      blockers.push(TransactionAutomationBlockerCode.SLA_OVERDUE);
    }

    const candidates: TransactionAutomationCandidateCode[] = [];

    if (
      input.transactionStatus === TransactionStatus.DELIVERED &&
      blockers.length === 0
    ) {
      candidates.push(
        TransactionAutomationCandidateCode.AUTO_COMPLETE_TRANSACTION,
      );

      candidates.push(
        TransactionAutomationCandidateCode.AUTO_RELEASE_ESCROW,
      );
    }

    if (
      input.hasPendingRefund &&
      !input.hasOpenDispute &&
      !input.amlCaseExists &&
      !input.hasActiveRestriction
    ) {
      candidates.push(
        TransactionAutomationCandidateCode.AUTO_RESOLVE_LOW_RISK_REFUND,
      );
    }

    const confidenceScore = Math.max(
      0,
      Math.min(
        100,
        100 -
          blockers.length * 15 -
          Number(input.requiresEscalation) * 20,
      ),
    );

    let readiness = TransactionAutomationReadiness.READY;

    if (blockers.length >= 3 || input.requiresEscalation) {
      readiness = TransactionAutomationReadiness.BLOCKED;
    } else if (blockers.length > 0) {
      readiness = TransactionAutomationReadiness.HUMAN_REVIEW;
    }

    return {
      readiness,
      confidenceScore,
      blockers,
      candidates,
      requiresHumanReview:
        readiness !== TransactionAutomationReadiness.READY,
      adminOverrideRequired:
        readiness === TransactionAutomationReadiness.BLOCKED,
    };
  }

  private minutesBetween(from: Date, to: Date): number {
    return Math.max(
      0,
      Math.floor((to.getTime() - from.getTime()) / (1000 * 60)),
    );
  }

  private parseStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
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

    const resolutionStatus =
      metadata.operationalResolutionStatus ===
        AdminTransactionOperationalResolutionStatus.RESOLVED ||
      metadata.operationalResolutionStatus ===
        AdminTransactionOperationalResolutionStatus.REOPENED
        ? metadata.operationalResolutionStatus
        : AdminTransactionOperationalResolutionStatus.UNRESOLVED;

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
      operationalResolutionStatus: resolutionStatus,
      operationalResolutionCategory:
        typeof metadata.operationalResolutionCategory === 'string'
          ? (metadata.operationalResolutionCategory as any)
          : null,
      operationalResolutionCode:
        typeof metadata.operationalResolutionCode === 'string'
          ? metadata.operationalResolutionCode
          : null,
      operationalResolutionSummary:
        typeof metadata.operationalResolutionSummary === 'string'
          ? metadata.operationalResolutionSummary
          : null,
      operationalResolvedAt:
        typeof metadata.operationalResolvedAt === 'string'
          ? new Date(metadata.operationalResolvedAt)
          : null,
      operationalResolvedById:
        typeof metadata.operationalResolvedById === 'string'
          ? metadata.operationalResolvedById
          : null,
      operationalReopenedAt:
        typeof metadata.operationalReopenedAt === 'string'
          ? new Date(metadata.operationalReopenedAt)
          : null,
      operationalReopenedById:
        typeof metadata.operationalReopenedById === 'string'
          ? metadata.operationalReopenedById
          : null,
      operationalReopenReason:
        typeof metadata.operationalReopenReason === 'string'
          ? metadata.operationalReopenReason
          : null,
      metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
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

  private buildWorkflow(input: {
    transactionStatus: TransactionStatus;
    paymentStatus: PaymentStatus;
    hasOpenDispute: boolean;
    hasPendingEvidenceReview: boolean;
    hasPendingDisputeEvidenceReview: boolean;
    hasPendingDeliveryEvidenceReview: boolean;
    hasRejectedDeliveryProof: boolean;
    hasPendingRefund: boolean;
    hasPendingPayout: boolean;
    hasActiveRestriction: boolean;
    requiresEscalation: boolean;
    operationalCaseStatus: AdminOwnershipOperationalStatus | null;
    assignedAdminId: string | null;
  }): AdminTransactionOperationalWorkflowDto {
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (input.hasOpenDispute) {
      blockers.push('OPEN_DISPUTE');
    }

    if (input.hasPendingDisputeEvidenceReview) {
      blockers.push('PENDING_DISPUTE_EVIDENCE_REVIEW');
    }

    if (input.hasPendingDeliveryEvidenceReview) {
      blockers.push('PENDING_DELIVERY_EVIDENCE_REVIEW');
    }

    if (input.hasRejectedDeliveryProof) {
      blockers.push('REJECTED_DELIVERY_PROOF');
    }

    if (input.hasPendingPayout) {
      blockers.push('PENDING_PAYOUT');
    }

    if (input.hasPendingRefund) {
      blockers.push('PENDING_REFUND');
    }

    if (input.hasPendingEvidenceReview) {
      warnings.push('PENDING_EVIDENCE_REVIEW');
    }

    if (input.hasActiveRestriction) {
      warnings.push('ACTIVE_RESTRICTION');
    }

    if (input.requiresEscalation) {
      warnings.push('ESCALATION_REQUIRED');
    }

    const ownershipConsistent = Boolean(
      input.assignedAdminId,
    );

    if (!ownershipConsistent) {
      warnings.push('UNASSIGNED_OPERATIONAL_CASE');
    }

    const resolutionAllowed = blockers.length === 0;

    const releaseAllowed =
      resolutionAllowed &&
      input.paymentStatus === PaymentStatus.SUCCESS;

    const workflowScore = Math.max(
      0,
      100 -
        blockers.length * 20 -
        warnings.length * 8,
    );

    let status =
      AdminTransactionOperationalWorkflowStatus.HEALTHY;

    if (warnings.length > 0) {
      status =
        AdminTransactionOperationalWorkflowStatus.WARNING;
    }

    if (blockers.length > 0) {
      status =
        AdminTransactionOperationalWorkflowStatus.BLOCKED;
    }

    const transitions = [
      {
        code: 'START_REVIEW',
        label: 'Start manual review',
        allowed: true,
        blockers: [],
        warnings: [],
      },
      {
        code: 'RESOLVE_CASE',
        label: 'Resolve operational case',
        allowed: resolutionAllowed,
        blockers,
        warnings,
      },
      {
        code: 'RELEASE_CASE',
        label: 'Release operational case',
        allowed: releaseAllowed,
        blockers,
        warnings,
      },
      {
        code: 'ESCALATE_CASE',
        label: 'Escalate operational case',
        allowed: true,
        blockers: [],
        warnings,
      },
    ];

    return {
      status,
      workflowScore,
      escalationRequired:
        input.requiresEscalation,
      ownershipConsistent,
      resolutionAllowed,
      releaseAllowed,
      blockers,
      warnings,
      allowedTransitions: transitions.filter(
        (item) => item.allowed,
      ),
      forbiddenTransitions: transitions.filter(
        (item) => !item.allowed,
      ),
    };
  }
}