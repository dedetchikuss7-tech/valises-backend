import { Injectable } from '@nestjs/common';
import {
  AdminOwnershipOperationalStatus,
  PaymentStatus,
  TransactionStatus,
} from '@prisma/client';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { AdminTransactionOperationsService } from './admin-transaction-operations.service';
import {
  AdminTransactionOperationItemDto,
  TransactionRecommendedAction,
} from './dto/admin-transaction-operation-item.dto';
import {
  TransactionOperationalAutomationCandidateCode,
  TransactionOperationalAdminBlockerCode,
  TransactionOperationalChecklistItemDto,
  TransactionOperationalChecklistItemStatus,
  TransactionOperationalPlaybookCode,
  TransactionOperationalPlaybookResponseDto,
  TransactionOperationalReadinessStatus,
} from './dto/admin-transaction-operational-playbook.dto';
import { AdminTransactionOperationalPlaybookSummaryDto } from './dto/admin-transaction-operational-playbook-summary.dto';
import { ListAdminTransactionOperationalPlaybooksQueryDto } from './dto/list-admin-transaction-operational-playbooks-query.dto';

@Injectable()
export class AdminTransactionOperationalPlaybooksService {
  constructor(
    private readonly adminTransactionOperationsService: AdminTransactionOperationsService,
  ) {}

  async list(
    query: ListAdminTransactionOperationalPlaybooksQueryDto,
  ): Promise<
    PaginatedListResponseDto<TransactionOperationalPlaybookResponseDto>
  > {
    const queue =
      await this.adminTransactionOperationsService.listQueue({});

    let items = queue.items.map((item) => this.buildPlaybook(item));

    items = this.applyFilters(items, query);

    const total = items.length;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return {
      items: items.slice(offset, offset + limit),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async summary(): Promise<AdminTransactionOperationalPlaybookSummaryDto> {
    const queue =
      await this.adminTransactionOperationsService.listQueue({});

    const items = queue.items.map((item) => this.buildPlaybook(item));

    return {
      generatedAt: new Date(),
      totalRows: items.length,

      readyCount: items.filter(
        (item) =>
          item.readinessStatus ===
          TransactionOperationalReadinessStatus.READY,
      ).length,

      monitoringCount: items.filter(
        (item) =>
          item.readinessStatus ===
          TransactionOperationalReadinessStatus.MONITORING,
      ).length,

      needsAdminReviewCount: items.filter(
        (item) =>
          item.readinessStatus ===
          TransactionOperationalReadinessStatus.NEEDS_ADMIN_REVIEW,
      ).length,

      blockedCount: items.filter(
        (item) =>
          item.readinessStatus ===
          TransactionOperationalReadinessStatus.BLOCKED,
      ).length,

      withAdminBlockersCount: items.filter(
        (item) => item.adminBlockers.length > 0,
      ).length,

      withAutomationCandidatesCount: items.filter(
        (item) => item.automationCandidates.length > 0,
      ).length,

      shouldEscalateCount: items.filter(
        (item) => item.shouldEscalate,
      ).length,

      canBeOperationallyClosedCount: items.filter(
        (item) => item.canBeOperationallyClosed,
      ).length,

      reviewDisputeEvidenceCount: items.filter(
        (item) =>
          item.playbookCode ===
          TransactionOperationalPlaybookCode.REVIEW_DISPUTE_EVIDENCE,
      ).length,

      reviewDeliveryProofCount: items.filter(
        (item) =>
          item.playbookCode ===
          TransactionOperationalPlaybookCode.REVIEW_DELIVERY_PROOF,
      ).length,

      reconcilePayoutCount: items.filter(
        (item) =>
          item.playbookCode ===
          TransactionOperationalPlaybookCode.RECONCILE_PAYOUT,
      ).length,

      reconcileRefundCount: items.filter(
        (item) =>
          item.playbookCode ===
          TransactionOperationalPlaybookCode.RECONCILE_REFUND,
      ).length,

      restrictionRiskReviewCount: items.filter(
        (item) =>
          item.playbookCode ===
          TransactionOperationalPlaybookCode.REVIEW_RESTRICTION_RISK,
      ).length,
    };
  }

  private buildPlaybook(
    item: AdminTransactionOperationItemDto,
  ): TransactionOperationalPlaybookResponseDto {
    const adminBlockers =
      this.buildAdminBlockers(item);

    const automationCandidates =
      this.buildAutomationCandidates(item);

    const readinessStatus =
      this.resolveReadinessStatus(item, adminBlockers);

    const playbookCode =
      this.resolvePlaybookCode(item);

    const checklist =
      this.buildChecklist(item);

    const canBeOperationallyClosed =
      adminBlockers.length === 0 &&
      !item.requiresEscalation &&
      !item.hasOpenDispute &&
      !item.hasPendingEvidenceReview &&
      !item.hasPendingRefund &&
      !item.hasPendingPayout;

    return {
      transactionId: item.transactionId,

      readinessStatus,

      playbookCode,

      playbookTitle:
        this.playbookTitle(playbookCode),

      playbookSummary:
        this.playbookSummary(playbookCode),

      adminBlockers,

      automationCandidates,

      nextBestAdminActions:
        this.nextBestActions(item),

      checklist,

      canBeOperationallyClosed,

      shouldEscalate:
        item.requiresEscalation,

      generatedAt: new Date(),
    };
  }

  private buildAdminBlockers(
    item: AdminTransactionOperationItemDto,
  ): TransactionOperationalAdminBlockerCode[] {
    const blockers: TransactionOperationalAdminBlockerCode[] =
      [];

    if (
      item.paymentStatus !== PaymentStatus.SUCCESS
    ) {
      blockers.push(
        TransactionOperationalAdminBlockerCode.PAYMENT_NOT_CONFIRMED,
      );
    }

    if (item.hasOpenDispute) {
      blockers.push(
        TransactionOperationalAdminBlockerCode.OPEN_DISPUTE,
      );
    }

    if (item.hasPendingEvidenceReview) {
      blockers.push(
        TransactionOperationalAdminBlockerCode.PENDING_EVIDENCE_REVIEW,
      );
    }

    if (
      item.hasPendingDeliveryEvidenceReview
    ) {
      blockers.push(
        TransactionOperationalAdminBlockerCode.PENDING_DELIVERY_EVIDENCE_REVIEW,
      );
    }

    if (
      item.hasRejectedDeliveryProof
    ) {
      blockers.push(
        TransactionOperationalAdminBlockerCode.REJECTED_DELIVERY_PROOF,
      );
    }

    if (item.hasActiveRestriction) {
      blockers.push(
        TransactionOperationalAdminBlockerCode.ACTIVE_USER_RESTRICTION,
      );
    }

    if (item.hasPendingPayout) {
      blockers.push(
        TransactionOperationalAdminBlockerCode.PENDING_PAYOUT,
      );
    }

    if (item.hasPendingRefund) {
      blockers.push(
        TransactionOperationalAdminBlockerCode.PENDING_REFUND,
      );
    }

    if (item.isOverdue) {
      blockers.push(
        TransactionOperationalAdminBlockerCode.SLA_OVERDUE,
      );
    }

    if (item.requiresEscalation) {
      blockers.push(
        TransactionOperationalAdminBlockerCode.REQUIRES_ESCALATION,
      );
    }

    return blockers;
  }

  private buildAutomationCandidates(
    item: AdminTransactionOperationItemDto,
  ): TransactionOperationalAutomationCandidateCode[] {
    const candidates: TransactionOperationalAutomationCandidateCode[] =
      [];

    if (item.hasPendingEvidenceReview) {
      candidates.push(
        TransactionOperationalAutomationCandidateCode.REQUEST_EVIDENCE_REVIEW,
      );
    }

    if (
      item.hasPendingDeliveryEvidenceReview
    ) {
      candidates.push(
        TransactionOperationalAutomationCandidateCode.REQUEST_DELIVERY_PROOF,
      );
    }

    if (item.hasPendingPayout) {
      candidates.push(
        TransactionOperationalAutomationCandidateCode.RECONCILE_PAYOUT_PROVIDER,
      );
    }

    if (item.hasPendingRefund) {
      candidates.push(
        TransactionOperationalAutomationCandidateCode.RECONCILE_REFUND_PROVIDER,
      );
    }

    if (item.requiresEscalation) {
      candidates.push(
        TransactionOperationalAutomationCandidateCode.ESCALATE_SLA_BREACH,
      );
    }

    if (
      !item.hasOpenDispute &&
      !item.hasPendingEvidenceReview &&
      !item.hasPendingRefund &&
      !item.hasPendingPayout
    ) {
      candidates.push(
        TransactionOperationalAutomationCandidateCode.CLOSE_LOW_RISK_CASE,
      );
    }

    return candidates;
  }

  private resolveReadinessStatus(
    item: AdminTransactionOperationItemDto,
    blockers: TransactionOperationalAdminBlockerCode[],
  ): TransactionOperationalReadinessStatus {
    if (
      blockers.length > 0 &&
      (item.hasOpenDispute ||
        item.requiresEscalation ||
        item.hasRejectedDeliveryProof)
    ) {
      return TransactionOperationalReadinessStatus.BLOCKED;
    }

    if (blockers.length > 0) {
      return TransactionOperationalReadinessStatus.NEEDS_ADMIN_REVIEW;
    }

    if (
      item.transactionStatus ===
        TransactionStatus.DELIVERED ||
      item.hasPendingPayout ||
      item.hasPendingRefund
    ) {
      return TransactionOperationalReadinessStatus.MONITORING;
    }

    return TransactionOperationalReadinessStatus.READY;
  }

  private resolvePlaybookCode(
    item: AdminTransactionOperationItemDto,
  ): TransactionOperationalPlaybookCode {
    if (
      item.hasOpenDispute ||
      item.hasPendingDisputeEvidenceReview
    ) {
      return TransactionOperationalPlaybookCode.REVIEW_DISPUTE_EVIDENCE;
    }

    if (
      item.hasPendingDeliveryEvidenceReview ||
      item.hasRejectedDeliveryProof
    ) {
      return TransactionOperationalPlaybookCode.REVIEW_DELIVERY_PROOF;
    }

    if (item.hasPendingPayout) {
      return TransactionOperationalPlaybookCode.RECONCILE_PAYOUT;
    }

    if (item.hasPendingRefund) {
      return TransactionOperationalPlaybookCode.RECONCILE_REFUND;
    }

    if (item.hasActiveRestriction) {
      return TransactionOperationalPlaybookCode.REVIEW_RESTRICTION_RISK;
    }

    if (item.requiresEscalation) {
      return TransactionOperationalPlaybookCode.ESCALATE_STALE_CASE;
    }

    if (
      item.operationalCaseStatus ===
      AdminOwnershipOperationalStatus.DONE
    ) {
      return TransactionOperationalPlaybookCode.CLOSE_OPERATIONAL_CASE;
    }

    return TransactionOperationalPlaybookCode.MONITOR_ONLY;
  }

  private buildChecklist(
    item: AdminTransactionOperationItemDto,
  ): TransactionOperationalChecklistItemDto[] {
    return [
      {
        code: 'PAYMENT_CONFIRMED',
        label: 'Payment confirmed',
        status:
          item.paymentStatus === PaymentStatus.SUCCESS
            ? TransactionOperationalChecklistItemStatus.DONE
            : TransactionOperationalChecklistItemStatus.BLOCKED,
        isRequired: true,
        reason:
          item.paymentStatus === PaymentStatus.SUCCESS
            ? 'Payment successfully confirmed.'
            : 'Payment confirmation missing.',
      },
      {
        code: 'DISPUTE_REVIEW',
        label: 'Dispute review completed',
        status: item.hasOpenDispute
          ? TransactionOperationalChecklistItemStatus.PENDING
          : TransactionOperationalChecklistItemStatus.DONE,
        isRequired: item.hasOpenDispute,
        reason: item.hasOpenDispute
          ? 'Open dispute still requires admin review.'
          : 'No active dispute.',
      },
      {
        code: 'EVIDENCE_REVIEW',
        label: 'Evidence reviewed',
        status: item.hasPendingEvidenceReview
          ? TransactionOperationalChecklistItemStatus.PENDING
          : TransactionOperationalChecklistItemStatus.DONE,
        isRequired: item.hasPendingEvidenceReview,
        reason: item.hasPendingEvidenceReview
          ? 'Evidence attachments still pending review.'
          : 'No pending evidence review.',
      },
      {
        code: 'DELIVERY_PROOF',
        label: 'Delivery proof validated',
        status: item.hasRejectedDeliveryProof
          ? TransactionOperationalChecklistItemStatus.BLOCKED
          : item.hasPendingDeliveryEvidenceReview
          ? TransactionOperationalChecklistItemStatus.PENDING
          : TransactionOperationalChecklistItemStatus.DONE,
        isRequired:
          item.transactionStatus ===
          TransactionStatus.DELIVERED,
        reason: item.hasRejectedDeliveryProof
          ? 'Delivery proof was rejected.'
          : item.hasPendingDeliveryEvidenceReview
          ? 'Delivery proof still pending review.'
          : 'Delivery proof state acceptable.',
      },
    ];
  }

  private nextBestActions(
    item: AdminTransactionOperationItemDto,
  ): string[] {
    const actions: string[] = [];

    if (item.requiresEscalation) {
      actions.push(
        'Escalate this transaction to senior operations review.',
      );
    }

    if (item.hasOpenDispute) {
      actions.push(
        'Review dispute evidence and determine operational ownership.',
      );
    }

    if (
      item.hasPendingDeliveryEvidenceReview
    ) {
      actions.push(
        'Review pending delivery proof attachments.',
      );
    }

    if (item.hasPendingPayout) {
      actions.push(
        'Reconcile payout provider processing state.',
      );
    }

    if (item.hasPendingRefund) {
      actions.push(
        'Reconcile refund provider processing state.',
      );
    }

    if (item.hasActiveRestriction) {
      actions.push(
        'Review user restriction impact before operational closure.',
      );
    }

    if (actions.length === 0) {
      actions.push(
        'Continue operational monitoring only.',
      );
    }

    return actions;
  }

  private playbookTitle(
    code: TransactionOperationalPlaybookCode,
  ): string {
    return code
      .split('_')
      .join(' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private playbookSummary(
    code: TransactionOperationalPlaybookCode,
  ): string {
    const map: Record<
      TransactionOperationalPlaybookCode,
      string
    > = {
      REVIEW_DISPUTE_EVIDENCE:
        'This transaction requires dispute and evidence review.',
      REVIEW_DELIVERY_PROOF:
        'This transaction requires delivery proof validation.',
      RECONCILE_PAYOUT:
        'This transaction requires payout reconciliation.',
      RECONCILE_REFUND:
        'This transaction requires refund reconciliation.',
      REVIEW_RESTRICTION_RISK:
        'This transaction requires user restriction risk review.',
      ESCALATE_STALE_CASE:
        'This transaction requires operational escalation.',
      CLOSE_OPERATIONAL_CASE:
        'This operational case can likely be closed.',
      MONITOR_ONLY:
        'This transaction currently only requires monitoring.',
    };

    return map[code];
  }

  private applyFilters(
    items: TransactionOperationalPlaybookResponseDto[],
    query: ListAdminTransactionOperationalPlaybooksQueryDto,
  ) {
    return items.filter((item) => {
      if (
        query.readinessStatus &&
        item.readinessStatus !==
          query.readinessStatus
      ) {
        return false;
      }

      if (
        query.playbookCode &&
        item.playbookCode !==
          query.playbookCode
      ) {
        return false;
      }

      if (
        query.hasAdminBlockers !==
          undefined &&
        Boolean(item.adminBlockers.length > 0) !==
          query.hasAdminBlockers
      ) {
        return false;
      }

      if (
        query.hasAutomationCandidates !==
          undefined &&
        Boolean(
          item.automationCandidates.length > 0,
        ) !==
          query.hasAutomationCandidates
      ) {
        return false;
      }

      if (query.q) {
        const q = query.q.toLowerCase();

        const haystack = [
          item.transactionId,
          item.playbookCode,
          item.playbookTitle,
          item.playbookSummary,
          ...item.adminBlockers,
          ...item.automationCandidates,
          ...item.nextBestAdminActions,
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }
}