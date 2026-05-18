import { ApiProperty } from '@nestjs/swagger';
import {
  AmlCaseStatus,
  AmlDecisionAction,
  AmlRiskLevel,
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  DisputeOutcome,
  DisputeReasonCode,
  DisputeStatus,
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentType,
  PaymentRailProvider,
  PaymentStatus,
  PayoutMethodType,
  PayoutProvider,
  PayoutStatus,
  RefundProvider,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { AdminTransactionOperationItemDto } from './admin-transaction-operation-item.dto';
import { AdminTransactionOperationalCaseResponseDto } from './admin-transaction-operational-case-response.dto';
import { AdminTransactionOperationalAutomationDto } from './admin-transaction-operational-automation.dto';
import { AdminTransactionOperationalResolutionDto } from './admin-transaction-operational-resolution.dto';
import { AdminTransactionOperationalExecutionReadinessDto } from './admin-transaction-operational-execution-readiness.dto';

export class AdminTransactionOperationLifecycleDto {
  @ApiProperty()
  transactionId!: string;

  @ApiProperty({ enum: TransactionStatus })
  transactionStatus!: TransactionStatus;

  @ApiProperty({
    type: AdminTransactionOperationalAutomationDto,
  })
  automation!: AdminTransactionOperationalAutomationDto;

  @ApiProperty({
    type: AdminTransactionOperationalResolutionDto,
  })
  resolution!: AdminTransactionOperationalResolutionDto;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({
    type: AdminTransactionOperationalExecutionReadinessDto,
  })
  executionReadiness!: AdminTransactionOperationalExecutionReadinessDto;

  @ApiProperty()
  escrowAmount!: number;

  @ApiProperty()
  commission!: number;

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

  @ApiProperty({ nullable: true })
  paymentConfirmedAt!: Date | null;

  @ApiProperty({ nullable: true })
  deliveryConfirmedAt!: Date | null;

  @ApiProperty({ nullable: true })
  deliveryCodeGeneratedAt!: Date | null;

  @ApiProperty({ nullable: true })
  deliveryCodeExpiresAt!: Date | null;

  @ApiProperty({ nullable: true })
  deliveryCodeConsumedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AdminTransactionOperationEvidenceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: EvidenceAttachmentObjectType })
  targetType!: EvidenceAttachmentObjectType;

  @ApiProperty()
  targetId!: string;

  @ApiProperty({ enum: EvidenceAttachmentType })
  attachmentType!: EvidenceAttachmentType;

  @ApiProperty({ enum: EvidenceAttachmentStatus })
  status!: EvidenceAttachmentStatus;

  @ApiProperty()
  label!: string;

  @ApiProperty({ nullable: true })
  fileName!: string | null;

  @ApiProperty({ nullable: true })
  mimeType!: string | null;

  @ApiProperty({ nullable: true })
  sizeBytes!: number | null;

  @ApiProperty({ nullable: true })
  uploadedById!: string | null;

  @ApiProperty({ nullable: true })
  reviewedByAdminId!: string | null;

  @ApiProperty({ nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ nullable: true })
  rejectionReason!: string | null;

  @ApiProperty({ nullable: true })
  reviewNotes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AdminTransactionOperationDisputeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: DisputeStatus })
  status!: DisputeStatus;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ enum: DisputeReasonCode })
  reasonCode!: DisputeReasonCode;

  @ApiProperty()
  openedById!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ enum: DisputeOutcome, nullable: true })
  resolutionOutcome!: DisputeOutcome | null;

  @ApiProperty({ nullable: true })
  refundAmount!: number | null;

  @ApiProperty({ nullable: true })
  releaseAmount!: number | null;
}

export class AdminTransactionOperationPayoutDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PayoutStatus })
  status!: PayoutStatus;

  @ApiProperty({ enum: PayoutProvider })
  provider!: PayoutProvider;

  @ApiProperty({ enum: PaymentRailProvider, nullable: true })
  railProvider!: PaymentRailProvider | null;

  @ApiProperty({ enum: PayoutMethodType, nullable: true })
  payoutMethodType!: PayoutMethodType | null;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ nullable: true })
  externalReference!: string | null;

  @ApiProperty({ nullable: true })
  failureReason!: string | null;

  @ApiProperty({ nullable: true })
  requestedAt!: Date | null;

  @ApiProperty({ nullable: true })
  processedAt!: Date | null;

  @ApiProperty({ nullable: true })
  paidAt!: Date | null;
}

export class AdminTransactionOperationRefundDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: RefundStatus })
  status!: RefundStatus;

  @ApiProperty({ enum: RefundProvider })
  provider!: RefundProvider;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ nullable: true })
  externalReference!: string | null;

  @ApiProperty({ nullable: true })
  failureReason!: string | null;

  @ApiProperty({ nullable: true })
  requestedAt!: Date | null;

  @ApiProperty({ nullable: true })
  processedAt!: Date | null;

  @ApiProperty({ nullable: true })
  refundedAt!: Date | null;
}

export class AdminTransactionOperationAmlCaseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AmlCaseStatus })
  status!: AmlCaseStatus;

  @ApiProperty({ enum: AmlRiskLevel })
  riskLevel!: AmlRiskLevel;

  @ApiProperty({ enum: AmlDecisionAction })
  currentAction!: AmlDecisionAction;

  @ApiProperty({ enum: AmlDecisionAction })
  recommendedAction!: AmlDecisionAction;

  @ApiProperty({ type: [String] })
  signalCodes!: string[];

  @ApiProperty()
  signalCount!: number;

  @ApiProperty({ nullable: true })
  reasonSummary!: string | null;

  @ApiProperty()
  openedAt!: Date;

  @ApiProperty({ nullable: true })
  resolvedAt!: Date | null;
}

export class AdminTransactionOperationRestrictionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: BehaviorRestrictionKind })
  kind!: BehaviorRestrictionKind;

  @ApiProperty({ enum: BehaviorRestrictionScope })
  scope!: BehaviorRestrictionScope;

  @ApiProperty({ enum: BehaviorRestrictionStatus })
  status!: BehaviorRestrictionStatus;

  @ApiProperty()
  reasonCode!: string;

  @ApiProperty({ nullable: true })
  reasonSummary!: string | null;

  @ApiProperty()
  imposedAt!: Date;

  @ApiProperty({ nullable: true })
  expiresAt!: Date | null;
}

export class AdminTransactionOperationDetailDto {
  @ApiProperty({ type: AdminTransactionOperationItemDto })
  queueItem!: AdminTransactionOperationItemDto;

  @ApiProperty({
    type: AdminTransactionOperationalCaseResponseDto,
    nullable: true,
  })
  operationalCase!: AdminTransactionOperationalCaseResponseDto | null;

  @ApiProperty({ type: AdminTransactionOperationLifecycleDto })
  lifecycle!: AdminTransactionOperationLifecycleDto;

  @ApiProperty({ type: [AdminTransactionOperationEvidenceDto] })
  evidence!: AdminTransactionOperationEvidenceDto[];

  @ApiProperty({ type: [AdminTransactionOperationDisputeDto] })
  disputes!: AdminTransactionOperationDisputeDto[];

  @ApiProperty({
    type: AdminTransactionOperationPayoutDto,
    nullable: true,
  })
  payout!: AdminTransactionOperationPayoutDto | null;

  @ApiProperty({
    type: AdminTransactionOperationRefundDto,
    nullable: true,
  })
  refund!: AdminTransactionOperationRefundDto | null;

  @ApiProperty({
    type: AdminTransactionOperationAmlCaseDto,
    nullable: true,
  })
  amlCase!: AdminTransactionOperationAmlCaseDto | null;

  @ApiProperty({ type: [AdminTransactionOperationRestrictionDto] })
  restrictions!: AdminTransactionOperationRestrictionDto[];

  @ApiProperty({ type: [String] })
  nextOperationalSteps!: string[];
}