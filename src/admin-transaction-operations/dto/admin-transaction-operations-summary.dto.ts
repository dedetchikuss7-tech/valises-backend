import { ApiProperty } from '@nestjs/swagger';

export class AdminTransactionOperationsSummaryDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  highSeverityCount!: number;

  @ApiProperty()
  mediumSeverityCount!: number;

  @ApiProperty()
  lowSeverityCount!: number;

  @ApiProperty()
  requiresAdminAttentionCount!: number;

  @ApiProperty()
  requiresEscalationCount!: number;

  @ApiProperty()
  overdueCount!: number;

  @ApiProperty()
  staleCount!: number;

  @ApiProperty()
  openDisputeCount!: number;

  @ApiProperty()
  pendingEvidenceReviewCount!: number;

  @ApiProperty()
  pendingDisputeEvidenceReviewCount!: number;

  @ApiProperty()
  pendingDeliveryEvidenceReviewCount!: number;

  @ApiProperty()
  missingAcceptedDeliveryProofCount!: number;

  @ApiProperty()
  rejectedDeliveryProofCount!: number;

  @ApiProperty()
  pendingPayoutCount!: number;

  @ApiProperty()
  pendingRefundCount!: number;

  @ApiProperty()
  activeRestrictionCount!: number;

  @ApiProperty()
  operationalCaseCount!: number;

  @ApiProperty()
  unassignedOperationalCaseCount!: number;
}