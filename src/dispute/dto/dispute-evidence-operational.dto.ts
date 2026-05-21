import { ApiProperty } from '@nestjs/swagger';

export enum DisputeEvidenceLifecycleStatus {
  MISSING = 'MISSING',
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum DisputeEvidenceVerificationStatus {
  NOT_REVIEWED = 'NOT_REVIEWED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
}

export class DisputeEvidenceOperationalDto {
  @ApiProperty({ enum: DisputeEvidenceLifecycleStatus })
  lifecycleStatus!: DisputeEvidenceLifecycleStatus;

  @ApiProperty({ enum: DisputeEvidenceVerificationStatus })
  verificationStatus!: DisputeEvidenceVerificationStatus;

  @ApiProperty()
  requiresReview!: boolean;

  @ApiProperty()
  evidenceCompleteness!: number;

  @ApiProperty({ type: [String] })
  blockingIssues!: string[];

  @ApiProperty({ type: [String] })
  fraudSignals!: string[];

  @ApiProperty()
  disputeLinked!: boolean;

  @ApiProperty()
  deliveryProofPresent!: boolean;

  @ApiProperty()
  timelineConsistent!: boolean;

  @ApiProperty()
  operationalSummary!: string;
}