import { ApiProperty } from '@nestjs/swagger';

export enum DeliveryProofStatus {
  NOT_UPLOADED = 'NOT_UPLOADED',
  UPLOADED = 'UPLOADED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export class DeliveryProofOperationalDto {
  @ApiProperty({
    enum: DeliveryProofStatus,
  })
  proofStatus!: DeliveryProofStatus;

  @ApiProperty({
    nullable: true,
  })
  uploadedAt!: Date | null;

  @ApiProperty({
    nullable: true,
  })
  validatedAt!: Date | null;

  @ApiProperty()
  disputeLinked!: boolean;

  @ApiProperty()
  requiresAdminReview!: boolean;

  @ApiProperty({
    type: [String],
  })
  fraudSignals!: string[];

  @ApiProperty()
  timelineConsistency!: boolean;

  @ApiProperty()
  operationalSummary!: string;
}