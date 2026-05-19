import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, TransactionStatus } from '@prisma/client';
import { AdminTransactionOperationalAutomationSummaryDto } from './admin-transaction-operational-automation-summary.dto';
import { AdminTransactionOperationalResolutionDto } from './admin-transaction-operational-resolution.dto';
import { AdminTransactionOperationalExecutionReadinessDto } from './admin-transaction-operational-execution-readiness.dto';
import { AdminTransactionOperationalDecisionMatrixDto } from './admin-transaction-operational-decision.dto';
import { AdminTransactionOperationalRoutingDto } from './admin-transaction-operational-routing.dto';
import { AdminTransactionOperationalOwnershipDto } from './admin-transaction-operational-ownership.dto';

export enum TransactionOperationalSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TransactionRecommendedAction {
  REVIEW_DISPUTE_AND_EVIDENCE = 'REVIEW_DISPUTE_AND_EVIDENCE',
  REVIEW_DISPUTE = 'REVIEW_DISPUTE',
  REVIEW_EVIDENCE = 'REVIEW_EVIDENCE',
  REVIEW_DELIVERY_PROOF = 'REVIEW_DELIVERY_PROOF',
  REVIEW_USER_RESTRICTION = 'REVIEW_USER_RESTRICTION',
  MONITOR_PAYOUT = 'MONITOR_PAYOUT',
  MONITOR_REFUND = 'MONITOR_REFUND',
  REVIEW_DELIVERY_READINESS = 'REVIEW_DELIVERY_READINESS',
  ESCALATE_OPERATIONAL_CASE = 'ESCALATE_OPERATIONAL_CASE',
  NO_ACTION_REQUIRED = 'NO_ACTION_REQUIRED',
}

export class AdminTransactionOperationItemDto {
  @ApiProperty()
  transactionId!: string;

  @ApiProperty({
    type: AdminTransactionOperationalExecutionReadinessDto,
  })
  executionReadiness!: AdminTransactionOperationalExecutionReadinessDto;

  @ApiProperty({
    type: AdminTransactionOperationalRoutingDto,
  })
  routing!: AdminTransactionOperationalRoutingDto;

  @ApiProperty({
    type: AdminTransactionOperationalOwnershipDto,
  })
  ownership!: AdminTransactionOperationalOwnershipDto;

  @ApiProperty({
    type: AdminTransactionOperationalDecisionMatrixDto,
  })
  decisionMatrix!: AdminTransactionOperationalDecisionMatrixDto;

  @ApiProperty({ enum: TransactionStatus })
  transactionStatus!: TransactionStatus;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty()
  amount!: number;

  @ApiProperty({
    type: AdminTransactionOperationalResolutionDto,
  })
  resolution!: AdminTransactionOperationalResolutionDto;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty()
  travelerId!: string;

  @ApiProperty({ nullable: true })
  packageId!: string | null;

  @ApiProperty({ nullable: true })
  tripId!: string | null;

  @ApiProperty({ nullable: true })
  corridorId!: string | null;

  @ApiProperty()
  hasOpenDispute!: boolean;

  @ApiProperty({ nullable: true })
  latestDisputeId!: string | null;

  @ApiProperty({ nullable: true })
  latestDisputeStatus!: string | null;

  @ApiProperty()
  hasPendingEvidenceReview!: boolean;

  @ApiProperty()
  pendingEvidenceReviewCount!: number;

  @ApiProperty()
  hasPendingDisputeEvidenceReview!: boolean;

  @ApiProperty()
  pendingDisputeEvidenceReviewCount!: number;

  @ApiProperty()
  hasPendingDeliveryEvidenceReview!: boolean;

  @ApiProperty()
  pendingDeliveryEvidenceReviewCount!: number;

  @ApiProperty()
  hasAcceptedDeliveryProof!: boolean;

  @ApiProperty()
  hasRejectedDeliveryProof!: boolean;

  @ApiProperty({ nullable: true })
  latestDeliveryProofStatus!: string | null;

  @ApiProperty()
  hasPendingRefund!: boolean;

  @ApiProperty()
  hasPendingPayout!: boolean;

  @ApiProperty()
  hasActiveRestriction!: boolean;

  @ApiProperty()
  hasOperationalCase!: boolean;

  @ApiProperty({ nullable: true })
  operationalCaseStatus!: string | null;

  @ApiProperty({ nullable: true })
  assignedAdminId!: string | null;

  @ApiProperty({ nullable: true })
  operationalPriority!: string | null;

  @ApiProperty()
  ageMinutes!: number;

  @ApiProperty()
  lastUpdatedAgeMinutes!: number;

  @ApiProperty({ nullable: true })
  disputeAgeMinutes!: number | null;

  @ApiProperty({ nullable: true })
  payoutAgeMinutes!: number | null;

  @ApiProperty({ nullable: true })
  refundAgeMinutes!: number | null;

  @ApiProperty({ nullable: true })
  pendingEvidenceOldestAgeMinutes!: number | null;

  @ApiProperty({ nullable: true })
  operationalCaseAgeMinutes!: number | null;

  @ApiProperty()
  isStale!: boolean;

  @ApiProperty()
  isOverdue!: boolean;

  @ApiProperty()
  requiresEscalation!: boolean;

  @ApiProperty({ type: [String] })
  escalationReasons!: string[];

  @ApiProperty()
  requiresAdminAttention!: boolean;

  @ApiProperty({ enum: TransactionOperationalSeverity })
  operationalSeverity!: TransactionOperationalSeverity;

  @ApiProperty({ enum: TransactionRecommendedAction })
  recommendedAction!: TransactionRecommendedAction;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiProperty({ type: [String] })
  pendingEvidenceTargetKeys!: string[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({
    type: AdminTransactionOperationalAutomationSummaryDto,
  })
  automation!: AdminTransactionOperationalAutomationSummaryDto;

  @ApiProperty()
  updatedAt!: Date;
}