import { Injectable } from '@nestjs/common';
import { PayoutStatus, RefundStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { AdminFinancialControlsService } from '../admin-financial-controls/admin-financial-controls.service';
import { AdminFinancialControlStatus } from '../admin-financial-controls/dto/list-admin-financial-controls-query.dto';
import {
  AdminFinancialOperationRiskDecisionDto,
  FinancialOperationRiskDecision,
  FinancialOperationRiskLevel,
} from './dto/admin-financial-operation-risk-decision.dto';
import {
  AdminFinancialOperationObjectType,
  AdminFinancialOperationPriority,
  AdminFinancialOperationRecommendedAction,
  AdminFinancialOperationsSortBy,
  AdminFinancialOperationsSortOrder,
  ListAdminFinancialOperationsQueryDto,
} from './dto/list-admin-financial-operations-query.dto';
import { AdminFinancialOperationResponseDto } from './dto/admin-financial-operation-response.dto';
import { AdminFinancialOperationsSummaryResponseDto } from './dto/admin-financial-operations-summary-response.dto';
import {
  AdminFinancialOperationSlaDto,
  FinancialOperationSlaStatus,
} from './dto/admin-financial-operation-sla.dto';
import {
  AdminFinancialOperationReadinessDto,
  FinancialOperationReadinessStatus,
} from './dto/admin-financial-operation-readiness.dto';
import { AdminProviderEventNormalizationDto } from './dto/admin-provider-event-normalization.dto';
import {
  AdminFinancialOperationWorkflowDto,
  AdminFinancialWorkflowStatus,
} from './dto/admin-financial-operation-workflow.dto';
import {
  AdminFinancialOperationEscalationDto,
  FinancialOperationEscalationLevel,
} from './dto/admin-financial-operation-escalation.dto';

type QueueItem = AdminFinancialOperationResponseDto;

@Injectable()
export class AdminFinancialOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialControlsService: AdminFinancialControlsService,
  ) {}

  async getSummary(): Promise<AdminFinancialOperationsSummaryResponseDto> {
    const page = await this.listOperations({
      limit: 100,
      offset: 0,
      sortBy: AdminFinancialOperationsSortBy.PRIORITY,
      sortOrder: AdminFinancialOperationsSortOrder.DESC,
    });

    const items = page.items;

    const failedOperationsCount = items.filter(
      (item) => Boolean(item.failureReason),
    ).length;

    const staleOperationsCount = items.filter(
      (item) =>
        item.providerEventNormalization?.staleProcessing === true,
    ).length;

    const escalatedOperationsCount = items.filter(
      (item) =>
        item.escalation?.escalationLevel ===
        FinancialOperationEscalationLevel.ESCALATED,
    ).length;

    const criticalOperationsCount = items.filter(
      (item) =>
        item.escalation?.escalationLevel ===
        FinancialOperationEscalationLevel.CRITICAL,
    ).length;

    const slaBreachesCount = items.filter(
      (item) => item.escalation?.slaBreached === true,
    ).length;

    const stuckOperationsCount = items.filter(
      (item) => item.escalation?.stuckOperation === true,
    ).length;

    return {
      generatedAt: new Date(),

      totalItems: items.length,

      highPriorityCount: items.filter(
        (item) => item.priority === AdminFinancialOperationPriority.HIGH,
      ).length,

      highRiskOperationsCount: items.filter(
        (item) => item.riskDecision?.riskLevel === FinancialOperationRiskLevel.HIGH,
      ).length,

      criticalRiskOperationsCount: items.filter(
        (item) => item.riskDecision?.riskLevel === FinancialOperationRiskLevel.CRITICAL,
      ).length,

      automationCandidateCount: items.filter(
        (item) => item.riskDecision?.automationCandidate === true,
      ).length,

      blockedAutomationCount: items.filter(
        (item) => item.riskDecision?.blocksAutomation === true,
      ).length,

      mediumPriorityCount: items.filter(
        (item) => item.priority === AdminFinancialOperationPriority.MEDIUM,
      ).length,

      lowPriorityCount: items.filter(
        (item) => item.priority === AdminFinancialOperationPriority.LOW,
      ).length,

      requiresActionCount: items.filter(
        (item) => item.requiresAction,
      ).length,

      payoutItems: items.filter(
        (item) =>
          item.objectType ===
          AdminFinancialOperationObjectType.PAYOUT,
      ).length,

      refundItems: items.filter(
        (item) =>
          item.objectType ===
          AdminFinancialOperationObjectType.REFUND,
      ).length,

      financialControlItems: items.filter(
        (item) =>
          item.objectType ===
          AdminFinancialOperationObjectType.FINANCIAL_CONTROL,
      ).length,

      failedOperationsCount,

      staleOperationsCount,

      escalatedOperationsCount,

      criticalOperationsCount,

      slaBreachesCount,

      stuckOperationsCount,

      providerOperationalSummary:
        this.buildProviderOperationalSummary(items),
    };
  }

  async listOperations(
    query: ListAdminFinancialOperationsQueryDto,
  ): Promise<PaginatedListResponseDto<QueueItem>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [payoutItems, refundItems, controlItems] = await Promise.all([
      this.loadPayoutItems(query),
      this.loadRefundItems(query),
      this.loadFinancialControlItems(query),
    ]);

    let items = [...payoutItems, ...refundItems, ...controlItems];

    items = items.map((item) => {
      const withOperationalSignals = {
        ...item,
        operationalReadiness: this.buildOperationalReadiness(item),
        operationalWorkflow: this.buildOperationalWorkflow(item),
        providerEventNormalization: this.buildProviderEventNormalization(item),
      };

      const withEscalationAndSla = {
        ...withOperationalSignals,
        escalation: this.buildEscalation(withOperationalSignals),
        sla: this.buildSla(withOperationalSignals),
      };

      return {
        ...withEscalationAndSla,
        riskDecision: this.buildRiskDecision(withEscalationAndSla),
      };
    });

    if (query.objectType) {
      items = items.filter((item) => item.objectType === query.objectType);
    }

    if (query.priority) {
      items = items.filter((item) => item.priority === query.priority);
    }

    if (query.requiresAction !== undefined) {
      items = items.filter((item) => item.requiresAction === query.requiresAction);
    }

    if (query.transactionId) {
      items = items.filter((item) => item.transactionId === query.transactionId);
    }

    if (query.userId) {
      items = items.filter((item) => {
        const snapshot = item.transactionSnapshot;
        return (
          snapshot?.senderId === query.userId ||
          snapshot?.travelerId === query.userId
        );
      });
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();

      items = items.filter((item) => {
        const snapshot = item.transactionSnapshot;

        const haystack = [
          item.objectType,
          item.objectId,
          item.transactionId,
          item.status,
          item.currency,
          item.priority,
          item.recommendedAction,
          item.provider ?? '',
          item.railProvider ?? '',
          item.methodType ?? '',
          item.externalReference ?? '',
          item.failureReason ?? '',
          snapshot?.status ?? '',
          snapshot?.paymentStatus ?? '',
          snapshot?.senderId ?? '',
          snapshot?.travelerId ?? '',
          item.operationalReadiness?.status ?? '',
          item.operationalWorkflow?.workflowStatus ?? '',
          item.providerEventNormalization?.summary ?? '',
          ...item.reasons,
          ...(item.operationalReadiness?.blockers ?? []),
          ...(item.operationalReadiness?.warnings ?? []),
          ...(item.operationalWorkflow?.activeStages ?? []),
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    const sortBy = query.sortBy ?? AdminFinancialOperationsSortBy.PRIORITY;
    const sortOrder = query.sortOrder ?? AdminFinancialOperationsSortOrder.DESC;

    items.sort((a, b) => {
      const compare = this.compareItems(a, b, sortBy);
      return sortOrder === AdminFinancialOperationsSortOrder.ASC
        ? compare
        : -compare;
    });

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

  private async loadPayoutItems(
    query: Partial<ListAdminFinancialOperationsQueryDto>,
  ): Promise<QueueItem[]> {
    const payouts = await this.prisma.payout.findMany({
      where: {
        ...(query.transactionId ? { transactionId: query.transactionId } : {}),
        ...(query.userId
          ? {
              transaction: {
                OR: [{ senderId: query.userId }, { travelerId: query.userId }],
              },
            }
          : {}),
      },
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
      take: 200,
    });

    return payouts.map((payout) => {
      const classification = this.classifyPayout(payout.status);

      return {
        objectType: AdminFinancialOperationObjectType.PAYOUT,
        objectId: payout.id,
        transactionId: payout.transactionId,
        status: payout.status,
        amount: Number(payout.amount),
        currency: payout.currency,
        priority: classification.priority,
        requiresAction: classification.requiresAction,
        recommendedAction: classification.recommendedAction,
        reasons: classification.reasons,
        ageMinutes: this.computeAgeMinutes(payout.requestedAt ?? payout.createdAt),
        createdAt: payout.createdAt,
        updatedAt: payout.updatedAt ?? null,
        provider: payout.provider,
        railProvider: payout.railProvider ?? null,
        methodType: payout.payoutMethodType ?? null,
        externalReference: payout.externalReference ?? null,
        failureReason: payout.failureReason ?? null,
        transactionSnapshot: this.buildTransactionSnapshot(payout.transaction),
        operationalReadiness: null,
        operationalWorkflow: null,
        providerEventNormalization: null,
        escalation: null,
        sla: null,
        riskDecision: null,
        metadata:
          payout.metadata &&
          typeof payout.metadata === 'object' &&
          !Array.isArray(payout.metadata)
            ? (payout.metadata as Record<string, unknown>)
            : null,
      };
    });
  }

  private async loadRefundItems(
    query: Partial<ListAdminFinancialOperationsQueryDto>,
  ): Promise<QueueItem[]> {
    const refunds = await this.prisma.refund.findMany({
      where: {
        ...(query.transactionId ? { transactionId: query.transactionId } : {}),
        ...(query.userId
          ? {
              transaction: {
                OR: [{ senderId: query.userId }, { travelerId: query.userId }],
              },
            }
          : {}),
      },
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
      take: 200,
    });

    return refunds.map((refund) => {
      const classification = this.classifyRefund(refund.status);

      return {
        objectType: AdminFinancialOperationObjectType.REFUND,
        objectId: refund.id,
        transactionId: refund.transactionId,
        status: refund.status,
        amount: Number(refund.amount),
        currency: refund.currency,
        priority: classification.priority,
        requiresAction: classification.requiresAction,
        recommendedAction: classification.recommendedAction,
        reasons: classification.reasons,
        ageMinutes: this.computeAgeMinutes(refund.requestedAt ?? refund.createdAt),
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt ?? null,
        provider: refund.provider,
        railProvider: null,
        methodType: null,
        externalReference: refund.externalReference ?? null,
        failureReason: refund.failureReason ?? null,
        transactionSnapshot: this.buildTransactionSnapshot(refund.transaction),
        operationalReadiness: null,
        operationalWorkflow: null,
        providerEventNormalization: null,
        escalation: null,
        sla: null,
        riskDecision: null,
        metadata:
          refund.metadata &&
          typeof refund.metadata === 'object' &&
          !Array.isArray(refund.metadata)
            ? (refund.metadata as Record<string, unknown>)
            : null,
      };
    });
  }

  private async loadFinancialControlItems(
    query: Partial<ListAdminFinancialOperationsQueryDto>,
  ): Promise<QueueItem[]> {
    const controlsPage = await this.financialControlsService.listControls({
      transactionId: query.transactionId,
      userId: query.userId,
      requiresAction: true,
      limit: 100,
      offset: 0,
    });

    return controlsPage.items.map((control) => {
      const classification = this.classifyFinancialControl(control.derivedStatus);

      return {
        objectType: AdminFinancialOperationObjectType.FINANCIAL_CONTROL,
        objectId: control.transactionId,
        transactionId: control.transactionId,
        status: control.derivedStatus,
        amount: Number(control.transactionAmount),
        currency: control.currency,
        priority: classification.priority,
        requiresAction: classification.requiresAction,
        recommendedAction: classification.recommendedAction,
        reasons: [
          ...classification.reasons,
          ...control.mismatchSignals.map((signal) => `CONTROL_${signal}`),
        ],
        ageMinutes: this.computeAgeMinutes(control.updatedAt ?? control.createdAt),
        createdAt: control.createdAt,
        updatedAt: control.updatedAt ?? null,
        provider: null,
        railProvider: null,
        methodType: null,
        externalReference: null,
        failureReason: null,
        transactionSnapshot: {
          id: control.transactionId,
          status: control.transactionStatus,
          paymentStatus: control.paymentStatus,
          escrowAmount: control.remainingEscrowAmount,
          senderId: control.senderId,
          travelerId: control.travelerId,
          currency: control.currency,
        },
        operationalReadiness: null,
        operationalWorkflow: null,
        providerEventNormalization: null,
        escalation: null,
        sla: null,
        riskDecision: null,
        metadata: {
          ledgerCreditedAmount: control.ledgerCreditedAmount,
          ledgerReleasedAmount: control.ledgerReleasedAmount,
          ledgerRefundedAmount: control.ledgerRefundedAmount,
          payoutPaidAmount: control.payoutPaidAmount,
          refundPaidAmount: control.refundPaidAmount,
          remainingEscrowAmount: control.remainingEscrowAmount,
          lastAdminActionAt: control.lastAdminActionAt,
          lastAdminActionBy: control.lastAdminActionBy,
          lastAdminActionType: control.lastAdminActionType,
          adminActionCount: control.adminActionCount,
        },
      };
    });
  }

  private buildOperationalReadiness(
    item: QueueItem,
  ): AdminFinancialOperationReadinessDto {
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (item.priority === AdminFinancialOperationPriority.HIGH) {
      warnings.push('High priority financial operation');
    }

    if (item.failureReason) {
      blockers.push('Financial operation has failure reason');
    }

    if (
      item.objectType === AdminFinancialOperationObjectType.FINANCIAL_CONTROL &&
      item.requiresAction
    ) {
      blockers.push('Financial control breach requires review');
    }

    if (
      item.objectType === AdminFinancialOperationObjectType.PAYOUT &&
      item.status === PayoutStatus.FAILED
    ) {
      blockers.push('Failed payout requires reconciliation');
    }

    if (
      item.objectType === AdminFinancialOperationObjectType.REFUND &&
      item.status === RefundStatus.FAILED
    ) {
      blockers.push('Failed refund requires reconciliation');
    }

    const requiresEscalation =
      item.priority === AdminFinancialOperationPriority.HIGH &&
      item.requiresAction;

    const requiresManualReview = blockers.length > 0 || requiresEscalation;

    let status = FinancialOperationReadinessStatus.READY;

    if (blockers.length > 0) {
      status = FinancialOperationReadinessStatus.BLOCKED;
    } else if (requiresEscalation) {
      status = FinancialOperationReadinessStatus.ESCALATED;
    } else if (warnings.length > 0) {
      status = FinancialOperationReadinessStatus.NEEDS_REVIEW;
    }

    return {
      status,
      blockers,
      warnings,
      canExecute: blockers.length === 0,
      requiresEscalation,
      requiresManualReview,
      summary:
        blockers[0] ??
        warnings[0] ??
        'Financial operation is operationally ready.',
    };
  }

  private buildOperationalWorkflow(
    item: QueueItem,
  ): AdminFinancialOperationWorkflowDto {
    const activeStages: string[] = [];
    const completedStages: string[] = [];
    const pendingStages: string[] = [];

    if (item.requiresAction) {
      activeStages.push('ADMIN_REVIEW');
    }

    if (item.failureReason) {
      activeStages.push('FAILURE_INVESTIGATION');
    }

    if (
      item.status === PayoutStatus.PAID ||
      item.status === RefundStatus.REFUNDED
    ) {
      completedStages.push('FINANCIAL_SETTLEMENT');
    } else {
      pendingStages.push('FINANCIAL_SETTLEMENT');
    }

    if (item.objectType === AdminFinancialOperationObjectType.FINANCIAL_CONTROL) {
      activeStages.push('CONTROL_RECONCILIATION');
    }

    const operationallyBlocked =
      Boolean(item.failureReason) ||
      item.priority === AdminFinancialOperationPriority.HIGH;

    let workflowStatus = AdminFinancialWorkflowStatus.READY;

    if (operationallyBlocked) {
      workflowStatus = AdminFinancialWorkflowStatus.BLOCKED;
    } else if (item.requiresAction) {
      workflowStatus = AdminFinancialWorkflowStatus.MONITORING;
    }

    if (
      completedStages.includes('FINANCIAL_SETTLEMENT') &&
      !item.requiresAction
    ) {
      workflowStatus = AdminFinancialWorkflowStatus.COMPLETED;
    }

    return {
      workflowStatus,
      activeStages,
      completedStages,
      pendingStages,
      requiresHumanAction: item.requiresAction,
      operationallyBlocked,
      summary:
        activeStages[0] ??
        completedStages[0] ??
        'Financial workflow is healthy.',
    };
  }

  private buildProviderEventNormalization(
    item: QueueItem,
  ): AdminProviderEventNormalizationDto {
    if (item.objectType === AdminFinancialOperationObjectType.FINANCIAL_CONTROL) {
      return {
        duplicatedIdempotencyKey: false,
        missingExternalReference: false,
        invalidLifecycleTransition: false,
        orphanProviderEvent: false,
        staleProcessing: false,
        providerMismatch: false,
        requiresManualReview: false,
        summary: 'Provider webhook normalization is not applicable to financial controls.',
      };
    }

    const metadata = item.metadata ?? {};
    const ageMinutes = this.computeAgeMinutes(item.createdAt);

    const duplicatedIdempotencyKey =
      metadata.duplicatedIdempotencyKey === true;

    const invalidLifecycleTransition =
      metadata.invalidLifecycleTransition === true;

    const orphanProviderEvent =
      metadata.orphanProviderEvent === true;

    const providerMismatch =
      metadata.providerMismatch === true;

    const missingExternalReference =
      !item.externalReference || item.externalReference.trim().length === 0;

    const staleProcessing =
      ageMinutes >= 60 &&
      (item.status === PayoutStatus.REQUESTED ||
        item.status === PayoutStatus.PROCESSING ||
        item.status === RefundStatus.REQUESTED ||
        item.status === RefundStatus.PROCESSING);

    const requiresManualReview =
      duplicatedIdempotencyKey ||
      missingExternalReference ||
      invalidLifecycleTransition ||
      orphanProviderEvent ||
      staleProcessing ||
      providerMismatch;

    const summaryParts: string[] = [];

    if (duplicatedIdempotencyKey) {
      summaryParts.push('Duplicated provider idempotency key detected');
    }

    if (missingExternalReference) {
      summaryParts.push('Provider event missing external reference');
    }

    if (invalidLifecycleTransition) {
      summaryParts.push('Invalid provider lifecycle transition detected');
    }

    if (orphanProviderEvent) {
      summaryParts.push('Provider event appears detached from operational object');
    }

    if (staleProcessing) {
      summaryParts.push('Provider processing appears stale');
    }

    if (providerMismatch) {
      summaryParts.push('Provider mismatch detected');
    }

    return {
      duplicatedIdempotencyKey,
      missingExternalReference,
      invalidLifecycleTransition,
      orphanProviderEvent,
      staleProcessing,
      providerMismatch,
      requiresManualReview,
      summary:
        summaryParts.join('. ') ||
        'Provider webhook normalization checks passed.',
    };
  }

  private classifyPayout(status: PayoutStatus): {
    priority: AdminFinancialOperationPriority;
    requiresAction: boolean;
    recommendedAction: AdminFinancialOperationRecommendedAction;
    reasons: string[];
  } {
    if (status === PayoutStatus.FAILED) {
      return {
        priority: AdminFinancialOperationPriority.HIGH,
        requiresAction: true,
        recommendedAction: AdminFinancialOperationRecommendedAction.RETRY_PAYOUT,
        reasons: ['PAYOUT_FAILED', 'MANUAL_REVIEW_REQUIRED'],
      };
    }

    if (status === PayoutStatus.REQUESTED) {
      return {
        priority: AdminFinancialOperationPriority.MEDIUM,
        requiresAction: true,
        recommendedAction: AdminFinancialOperationRecommendedAction.PROCESS_PAYOUT,
        reasons: ['PAYOUT_REQUESTED', 'WAITING_PROCESSING'],
      };
    }

    if (status === PayoutStatus.PROCESSING) {
      return {
        priority: AdminFinancialOperationPriority.MEDIUM,
        requiresAction: true,
        recommendedAction: AdminFinancialOperationRecommendedAction.MONITOR_PAYOUT,
        reasons: ['PAYOUT_PROCESSING', 'WAITING_PROVIDER_CONFIRMATION'],
      };
    }

    return {
      priority: AdminFinancialOperationPriority.LOW,
      requiresAction: false,
      recommendedAction:
        AdminFinancialOperationRecommendedAction.NO_ACTION_REQUIRED,
      reasons: [`PAYOUT_${status}`],
    };
  }

  private classifyRefund(status: RefundStatus): {
    priority: AdminFinancialOperationPriority;
    requiresAction: boolean;
    recommendedAction: AdminFinancialOperationRecommendedAction;
    reasons: string[];
  } {
    if (status === RefundStatus.FAILED) {
      return {
        priority: AdminFinancialOperationPriority.HIGH,
        requiresAction: true,
        recommendedAction: AdminFinancialOperationRecommendedAction.RETRY_REFUND,
        reasons: ['REFUND_FAILED', 'MANUAL_REVIEW_REQUIRED'],
      };
    }

    if (status === RefundStatus.REQUESTED) {
      return {
        priority: AdminFinancialOperationPriority.MEDIUM,
        requiresAction: true,
        recommendedAction: AdminFinancialOperationRecommendedAction.PROCESS_REFUND,
        reasons: ['REFUND_REQUESTED', 'WAITING_PROCESSING'],
      };
    }

    if (status === RefundStatus.PROCESSING) {
      return {
        priority: AdminFinancialOperationPriority.MEDIUM,
        requiresAction: true,
        recommendedAction: AdminFinancialOperationRecommendedAction.MONITOR_REFUND,
        reasons: ['REFUND_PROCESSING', 'WAITING_PROVIDER_CONFIRMATION'],
      };
    }

    return {
      priority: AdminFinancialOperationPriority.LOW,
      requiresAction: false,
      recommendedAction:
        AdminFinancialOperationRecommendedAction.NO_ACTION_REQUIRED,
      reasons: [`REFUND_${status}`],
    };
  }

  private buildProviderOperationalSummary(
    items: QueueItem[],
  ) {
    const providerMap = new Map<
      string,
      {
        provider: string;
        totalOperations: number;
        failedOperations: number;
        staleOperations: number;
        requiresReview: boolean;
      }
    >();

    for (const item of items) {
      const provider = item.provider ?? 'UNKNOWN';

      if (!providerMap.has(provider)) {
        providerMap.set(provider, {
          provider,
          totalOperations: 0,
          failedOperations: 0,
          staleOperations: 0,
          requiresReview: false,
        });
      }

      const current = providerMap.get(provider)!;

      current.totalOperations += 1;

      if (item.failureReason) {
        current.failedOperations += 1;
      }

      if (
        item.providerEventNormalization?.staleProcessing
      ) {
        current.staleOperations += 1;
      }

      current.requiresReview =
        current.failedOperations > 0 ||
        current.staleOperations > 0;
    }

    const providers = Array.from(providerMap.values());

    return {
      totalProviders: providers.length,

      providersRequiringReview: providers.filter(
        (provider) => provider.requiresReview,
      ).length,

      totalFailedOperations: providers.reduce(
        (acc, provider) => acc + provider.failedOperations,
        0,
      ),

      totalStaleOperations: providers.reduce(
        (acc, provider) => acc + provider.staleOperations,
        0,
      ),

      providers,
    };
  }

  private buildSla(
    item: QueueItem,
  ): AdminFinancialOperationSlaDto {
    let expectedResolutionMinutes = 120;

    if (item.priority === AdminFinancialOperationPriority.HIGH) {
      expectedResolutionMinutes = 30;
    } else if (
      item.priority === AdminFinancialOperationPriority.MEDIUM
    ) {
      expectedResolutionMinutes = 90;
    }

    const elapsedMinutes = item.ageMinutes;

    const remainingMinutes = Math.max(
      0,
      expectedResolutionMinutes - elapsedMinutes,
    );

    const slaBreached =
      elapsedMinutes > expectedResolutionMinutes;

    const requiresUrgentIntervention =
      elapsedMinutes > expectedResolutionMinutes * 2;

    let agingBucket = 'FRESH';

    if (elapsedMinutes >= 30) {
      agingBucket = 'AGING';
    }

    if (elapsedMinutes >= 120) {
      agingBucket = 'STALE';
    }

    if (elapsedMinutes >= 1440) {
      agingBucket = 'CRITICAL';
    }

    let status = FinancialOperationSlaStatus.HEALTHY;

    if (slaBreached) {
      status = FinancialOperationSlaStatus.BREACHED;
    }

    if (elapsedMinutes >= expectedResolutionMinutes * 0.8) {
      status = FinancialOperationSlaStatus.WARNING;
    }

    if (requiresUrgentIntervention) {
      status = FinancialOperationSlaStatus.CRITICAL;
    }

    return {
      status,
      slaBreached,
      expectedResolutionMinutes,
      elapsedMinutes,
      remainingMinutes,
      requiresUrgentIntervention,
      agingBucket,
      summary: slaBreached
        ? 'Financial operation exceeded SLA expectations.'
        : 'Financial operation remains within SLA expectations.',
    };
  }

  private buildRiskDecision(
    item: QueueItem,
  ): AdminFinancialOperationRiskDecisionDto {
    const decisionReasons: string[] = [];
    let riskScore = 0;

    if (item.priority === AdminFinancialOperationPriority.HIGH) {
      riskScore += 30;
      decisionReasons.push('HIGH_PRIORITY');
    }

    if (item.failureReason) {
      riskScore += 25;
      decisionReasons.push('FAILURE_REASON_PRESENT');
    }

    if (item.operationalReadiness?.requiresManualReview) {
      riskScore += 20;
      decisionReasons.push('MANUAL_REVIEW_REQUIRED');
    }

    if (item.providerEventNormalization?.requiresManualReview) {
      riskScore += 20;
      decisionReasons.push('PROVIDER_REVIEW_REQUIRED');
    }

    if (item.escalation?.requiresImmediateAttention) {
      riskScore += 25;
      decisionReasons.push('IMMEDIATE_ATTENTION_REQUIRED');
    }

    if (item.sla?.slaBreached) {
      riskScore += 15;
      decisionReasons.push('SLA_BREACHED');
    }

    if (item.sla?.requiresUrgentIntervention) {
      riskScore += 25;
      decisionReasons.push('URGENT_INTERVENTION_REQUIRED');
    }

    if (
      item.objectType === AdminFinancialOperationObjectType.FINANCIAL_CONTROL &&
      item.requiresAction
    ) {
      riskScore += 20;
      decisionReasons.push('FINANCIAL_CONTROL_REVIEW_REQUIRED');
    }

    riskScore = Math.min(100, riskScore);

    let riskLevel = FinancialOperationRiskLevel.LOW;
    let decision = FinancialOperationRiskDecision.MONITOR;

    if (riskScore >= 25) {
      riskLevel = FinancialOperationRiskLevel.MEDIUM;
      decision = FinancialOperationRiskDecision.REVIEW;
    }

    if (riskScore >= 50) {
      riskLevel = FinancialOperationRiskLevel.HIGH;
      decision = FinancialOperationRiskDecision.ESCALATE;
    }

    if (riskScore >= 75) {
      riskLevel = FinancialOperationRiskLevel.CRITICAL;
      decision = FinancialOperationRiskDecision.HOLD;
    }

    const blocksAutomation =
      riskLevel === FinancialOperationRiskLevel.HIGH ||
      riskLevel === FinancialOperationRiskLevel.CRITICAL ||
      item.operationalReadiness?.canExecute === false;

    const automationCandidate =
      !blocksAutomation &&
      riskLevel === FinancialOperationRiskLevel.LOW &&
      item.requiresAction === false;

    const requiresSeniorReview =
      riskLevel === FinancialOperationRiskLevel.CRITICAL ||
      decision === FinancialOperationRiskDecision.HOLD;

    return {
      riskLevel,
      decision,
      riskScore,
      automationCandidate,
      blocksAutomation,
      requiresSeniorReview,
      decisionReasons,
      summary:
        decisionReasons[0] ??
        'Financial operation risk decision is low and monitor-only.',
    };
  }

  private classifyFinancialControl(status: AdminFinancialControlStatus): {
    priority: AdminFinancialOperationPriority;
    requiresAction: boolean;
    recommendedAction: AdminFinancialOperationRecommendedAction;
    reasons: string[];
  } {
    if (status === AdminFinancialControlStatus.BREACH) {
      return {
        priority: AdminFinancialOperationPriority.HIGH,
        requiresAction: true,
        recommendedAction:
          AdminFinancialOperationRecommendedAction.REVIEW_FINANCIAL_CONTROL,
        reasons: ['FINANCIAL_CONTROL_BREACH'],
      };
    }

    if (status === AdminFinancialControlStatus.WARNING) {
      return {
        priority: AdminFinancialOperationPriority.MEDIUM,
        requiresAction: true,
        recommendedAction:
          AdminFinancialOperationRecommendedAction.REVIEW_FINANCIAL_CONTROL,
        reasons: ['FINANCIAL_CONTROL_WARNING'],
      };
    }

    return {
      priority: AdminFinancialOperationPriority.LOW,
      requiresAction: false,
      recommendedAction:
        AdminFinancialOperationRecommendedAction.NO_ACTION_REQUIRED,
      reasons: ['FINANCIAL_CONTROL_CLEAN'],
    };
  }

  private buildEscalation(
    item: QueueItem,
  ): AdminFinancialOperationEscalationDto {
    const escalationReasons: string[] = [];

    const slaBreached = item.ageMinutes >= 120;

    const stuckOperation =
      item.ageMinutes >= 240 &&
      item.requiresAction;

    const providerStale =
      item.providerEventNormalization?.staleProcessing === true;

    if (slaBreached) {
      escalationReasons.push('SLA_BREACHED');
    }

    if (stuckOperation) {
      escalationReasons.push('STUCK_OPERATION');
    }

    if (providerStale) {
      escalationReasons.push('STALE_PROVIDER_PROCESSING');
    }

    if (item.failureReason) {
      escalationReasons.push('FAILURE_REASON_PRESENT');
    }

    if (
      item.priority === AdminFinancialOperationPriority.HIGH
    ) {
      escalationReasons.push('HIGH_PRIORITY_OPERATION');
    }

    let escalationLevel =
      FinancialOperationEscalationLevel.NORMAL;

    if (
      item.priority === AdminFinancialOperationPriority.MEDIUM ||
      providerStale
    ) {
      escalationLevel =
        FinancialOperationEscalationLevel.WATCH;
    }

    if (
      slaBreached ||
      item.failureReason
    ) {
      escalationLevel =
        FinancialOperationEscalationLevel.ESCALATED;
    }

    if (
      stuckOperation &&
      item.priority ===
        AdminFinancialOperationPriority.HIGH
    ) {
      escalationLevel =
        FinancialOperationEscalationLevel.CRITICAL;
    }

    const requiresImmediateAttention =
      escalationLevel ===
        FinancialOperationEscalationLevel.CRITICAL ||
      escalationLevel ===
        FinancialOperationEscalationLevel.ESCALATED;

    return {
      escalationLevel,

      slaBreached,

      stuckOperation,

      requiresImmediateAttention,

      escalationReasons,

      operationAgeMinutes: item.ageMinutes,

      summary:
        escalationReasons[0] ??
        'No escalation required.',
    };
  }

  private buildTransactionSnapshot(transaction: any) {
    if (!transaction) {
      return null;
    }

    return {
      id: transaction.id,
      status: transaction.status,
      paymentStatus: transaction.paymentStatus,
      escrowAmount: Number(transaction.escrowAmount ?? 0),
      senderId: transaction.senderId ?? null,
      travelerId: transaction.travelerId ?? null,
      currency: transaction.currency,
    };
  }

  private computeAgeMinutes(date: Date): number {
    const diffMs = Date.now() - date.getTime();
    return Math.max(0, Math.floor(diffMs / 60_000));
  }

  private compareItems(
    a: QueueItem,
    b: QueueItem,
    sortBy: AdminFinancialOperationsSortBy,
  ): number {
    switch (sortBy) {
      case AdminFinancialOperationsSortBy.CREATED_AT:
        return a.createdAt.getTime() - b.createdAt.getTime();

      case AdminFinancialOperationsSortBy.UPDATED_AT:
        return (
          (a.updatedAt ?? a.createdAt).getTime() -
          (b.updatedAt ?? b.createdAt).getTime()
        );

      case AdminFinancialOperationsSortBy.AGE_MINUTES:
        return a.ageMinutes - b.ageMinutes;

      case AdminFinancialOperationsSortBy.AMOUNT:
        return a.amount - b.amount;

      case AdminFinancialOperationsSortBy.PRIORITY:
      default:
        return this.priorityRank(a.priority) - this.priorityRank(b.priority);
    }
  }

  private priorityRank(priority: AdminFinancialOperationPriority): number {
    if (priority === AdminFinancialOperationPriority.HIGH) {
      return 3;
    }

    if (priority === AdminFinancialOperationPriority.MEDIUM) {
      return 2;
    }

    return 1;
  }
}