import { ApiProperty } from '@nestjs/swagger';
import {
  AmlCaseStatus,
  AmlDecisionAction,
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  DisputeStatus,
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentType,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { AdminTransactionOperationItemDto } from './admin-transaction-operation-item.dto';

export class AdminTransactionEvidenceSignalDto {
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

export class AdminTransactionDisputeSignalDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: DisputeStatus })
  status!: DisputeStatus;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  reasonCode!: string;

  @ApiProperty()
  openedById!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ nullable: true })
  resolutionOutcome!: string | null;

  @ApiProperty({ nullable: true })
  refundAmount!: number | null;

  @ApiProperty({ nullable: true })
  releaseAmount!: number | null;
}

export class AdminTransactionPayoutSignalDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PayoutStatus })
  status!: PayoutStatus;

  @ApiProperty()
  provider!: string;

  @ApiProperty({ nullable: true })
  railProvider!: string | null;

  @ApiProperty({ nullable: true })
  payoutMethodType!: string | null;

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

export class AdminTransactionRefundSignalDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: RefundStatus })
  status!: RefundStatus;

  @ApiProperty()
  provider!: string;

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

export class AdminTransactionAmlSignalDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AmlCaseStatus })
  status!: AmlCaseStatus;

  @ApiProperty()
  riskLevel!: string;

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

export class AdminTransactionRestrictionSignalDto {
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

export class AdminTransactionLifecycleSnapshotDto {
  @ApiProperty()
  transactionId!: string;

  @ApiProperty({ enum: TransactionStatus })
  transactionStatus!: TransactionStatus;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

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

export class AdminTransactionOperationDetailDto {
  @ApiProperty({ type: AdminTransactionOperationItemDto })
  queueItem!: AdminTransactionOperationItemDto;

  @ApiProperty({ type: AdminTransactionLifecycleSnapshotDto })
  lifecycle!: AdminTransactionLifecycleSnapshotDto;

  @ApiProperty({ type: [AdminTransactionEvidenceSignalDto] })
  evidence!: AdminTransactionEvidenceSignalDto[];

  @ApiProperty({ type: [AdminTransactionDisputeSignalDto] })
  disputes!: AdminTransactionDisputeSignalDto[];

  @ApiProperty({ type: AdminTransactionPayoutSignalDto, nullable: true })
  payout!: AdminTransactionPayoutSignalDto | null;

  @ApiProperty({ type: AdminTransactionRefundSignalDto, nullable: true })
  refund!: AdminTransactionRefundSignalDto | null;

  @ApiProperty({ type: AdminTransactionAmlSignalDto, nullable: true })
  amlCase!: AdminTransactionAmlSignalDto | null;

  @ApiProperty({ type: [AdminTransactionRestrictionSignalDto] })
  restrictions!: AdminTransactionRestrictionSignalDto[];

  @ApiProperty({ type: [String] })
  nextOperationalSteps!: string[];
}