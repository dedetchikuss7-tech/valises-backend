import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, TransactionStatus } from '@prisma/client';

export enum TransactionOperationalSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TransactionRecommendedAction {
  REVIEW_DISPUTE_AND_EVIDENCE = 'REVIEW_DISPUTE_AND_EVIDENCE',
  REVIEW_DISPUTE = 'REVIEW_DISPUTE',
  REVIEW_EVIDENCE = 'REVIEW_EVIDENCE',
  REVIEW_USER_RESTRICTION = 'REVIEW_USER_RESTRICTION',
  MONITOR_PAYOUT = 'MONITOR_PAYOUT',
  MONITOR_REFUND = 'MONITOR_REFUND',
  REVIEW_DELIVERY_READINESS = 'REVIEW_DELIVERY_READINESS',
  NO_ACTION_REQUIRED = 'NO_ACTION_REQUIRED',
}

export class AdminTransactionOperationItemDto {
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

  @ApiProperty()
  hasPendingEvidenceReview!: boolean;

  @ApiProperty()
  hasPendingRefund!: boolean;

  @ApiProperty()
  hasPendingPayout!: boolean;

  @ApiProperty()
  hasActiveRestriction!: boolean;

  @ApiProperty()
  requiresAdminAttention!: boolean;

  @ApiProperty({ enum: TransactionOperationalSeverity })
  operationalSeverity!: TransactionOperationalSeverity;

  @ApiProperty({ enum: TransactionRecommendedAction })
  recommendedAction!: TransactionRecommendedAction;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}