import { ApiProperty } from '@nestjs/swagger';

export class EvidenceAdminSummaryResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalAttachments!: number;

  @ApiProperty()
  pendingReviewCount!: number;

  @ApiProperty()
  acceptedCount!: number;

  @ApiProperty()
  rejectedCount!: number;

  @ApiProperty()
  adminOnlyCount!: number;

  @ApiProperty()
  ownerOnlyCount!: number;

  @ApiProperty()
  partiesVisibleCount!: number;

  @ApiProperty()
  packageEvidenceCount!: number;

  @ApiProperty()
  transactionEvidenceCount!: number;

  @ApiProperty()
  deliveryEvidenceCount!: number;

  @ApiProperty()
  disputeEvidenceCount!: number;

  @ApiProperty()
  payoutEvidenceCount!: number;

  @ApiProperty()
  refundEvidenceCount!: number;

  @ApiProperty()
  kycEvidenceCount!: number;

  @ApiProperty()
  adminCaseEvidenceCount!: number;

  @ApiProperty()
  otherEvidenceCount!: number;
}