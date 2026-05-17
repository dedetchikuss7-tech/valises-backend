import { ApiProperty } from '@nestjs/swagger';

export class AdminTransactionOperationalPlaybookSummaryDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  readyCount!: number;

  @ApiProperty()
  monitoringCount!: number;

  @ApiProperty()
  needsAdminReviewCount!: number;

  @ApiProperty()
  blockedCount!: number;

  @ApiProperty()
  withAdminBlockersCount!: number;

  @ApiProperty()
  withAutomationCandidatesCount!: number;

  @ApiProperty()
  shouldEscalateCount!: number;

  @ApiProperty()
  canBeOperationallyClosedCount!: number;

  @ApiProperty()
  reviewDisputeEvidenceCount!: number;

  @ApiProperty()
  reviewDeliveryProofCount!: number;

  @ApiProperty()
  reconcilePayoutCount!: number;

  @ApiProperty()
  reconcileRefundCount!: number;

  @ApiProperty()
  restrictionRiskReviewCount!: number;
}