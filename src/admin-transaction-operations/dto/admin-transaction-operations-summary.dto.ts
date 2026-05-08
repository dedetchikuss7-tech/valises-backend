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
  openDisputeCount!: number;

  @ApiProperty()
  pendingEvidenceReviewCount!: number;

  @ApiProperty()
  pendingPayoutCount!: number;

  @ApiProperty()
  pendingRefundCount!: number;

  @ApiProperty()
  activeRestrictionCount!: number;
}