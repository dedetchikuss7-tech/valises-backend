import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DeliveryProofStatus {
  NOT_UPLOADED = 'NOT_UPLOADED',
  UPLOADED = 'UPLOADED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',

  NOT_AVAILABLE = 'NOT_AVAILABLE',
  GENERATED = 'GENERATED',
  CONSUMED = 'CONSUMED',
  CONFIRMED = 'CONFIRMED',
  BLOCKED = 'BLOCKED',
  DISPUTED = 'DISPUTED',
}

export enum DeliveryProofTrustLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL_REVIEW = 'CRITICAL_REVIEW',
}

export class DeliveryProofOperationalDto {
  @ApiProperty({ enum: DeliveryProofStatus })
  proofStatus!: DeliveryProofStatus;

  @ApiPropertyOptional({ enum: DeliveryProofTrustLevel })
  trustLevel?: DeliveryProofTrustLevel;

  @ApiPropertyOptional()
  trustScore?: number;

  @ApiPropertyOptional()
  payoutEligible?: boolean;

  @ApiProperty()
  requiresAdminReview!: boolean;

  @ApiPropertyOptional()
  hasOpenDispute?: boolean;

  @ApiPropertyOptional()
  hasPayoutStarted?: boolean;

  @ApiPropertyOptional()
  deliveryConfirmed?: boolean;

  @ApiPropertyOptional()
  deliveryCodeGenerated?: boolean;

  @ApiPropertyOptional()
  deliveryCodeConsumed?: boolean;

  @ApiPropertyOptional({ nullable: true })
  generatedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  consumedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  confirmedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  uploadedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  validatedAt?: Date | null;

  @ApiPropertyOptional()
  disputeLinked?: boolean;

  @ApiPropertyOptional()
  timelineConsistency?: boolean;

  @ApiPropertyOptional({ type: [String] })
  blockingReasons?: string[];

  @ApiProperty({ type: [String] })
  fraudSignals!: string[];

  @ApiPropertyOptional({ type: [String] })
  recommendedActions?: string[];

  @ApiProperty()
  operationalSummary!: string;
}