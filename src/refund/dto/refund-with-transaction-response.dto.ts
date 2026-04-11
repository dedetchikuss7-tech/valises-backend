import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentStatus,
  RefundProvider,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';

class RefundTransactionSnapshotDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'tx_123',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction status',
    enum: TransactionStatus,
    example: TransactionStatus.DISPUTED,
  })
  status!: TransactionStatus;

  @ApiProperty({
    description: 'Transaction payment status',
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS,
  })
  paymentStatus!: PaymentStatus;

  @ApiProperty({
    description: 'Current escrow amount on transaction',
    example: 600,
  })
  escrowAmount!: number;

  @ApiProperty({
    description: 'Sender user ID',
    example: 'sender-1',
  })
  senderId!: string;

  @ApiProperty({
    description: 'Traveler user ID',
    example: 'traveler-1',
  })
  travelerId!: string;

  @ApiProperty({
    description: 'Transaction currency',
    example: 'XAF',
  })
  currency!: string;
}

class RefundAdminOperationalSnapshotDto {
  @ApiProperty({
    description: 'Whether the transaction currently has an OPEN dispute',
    example: true,
  })
  hasOpenDispute!: boolean;

  @ApiProperty({
    description: 'Whether payout is currently requested or processing',
    example: false,
  })
  hasRequestedPayout!: boolean;

  @ApiProperty({
    description: 'Whether refund is currently requested or processing',
    example: true,
  })
  hasRequestedRefund!: boolean;

  @ApiProperty({
    description: 'High-level admin attention flag',
    example: true,
  })
  requiresAdminAttention!: boolean;
}

export class RefundWithTransactionResponseDto {
  @ApiProperty({
    description: 'Refund ID',
    example: 'rf_123',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction ID linked to this refund',
    example: 'tx_123',
  })
  transactionId!: string;

  @ApiProperty({
    description: 'Refund provider',
    enum: RefundProvider,
    example: RefundProvider.MANUAL,
  })
  provider!: RefundProvider;

  @ApiProperty({
    description: 'Refund status',
    enum: RefundStatus,
    example: RefundStatus.REQUESTED,
  })
  status!: RefundStatus;

  @ApiProperty({
    description: 'Refund amount',
    example: 400,
  })
  amount!: number;

  @ApiProperty({
    description: 'Refund currency',
    example: 'XAF',
  })
  currency!: string;

  @ApiProperty({
    description: 'Provider-side external reference if present',
    example: 'manual-refund-001',
    nullable: true,
  })
  externalReference!: string | null;

  @ApiProperty({
    description: 'Failure reason if present',
    example: 'Provider rejected request',
    nullable: true,
  })
  failureReason!: string | null;

  @ApiProperty({
    description: 'Optional refund metadata',
    example: { reason: 'cancel_before_departure' },
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  metadata!: Record<string, any> | null;

  @ApiProperty({
    description: 'Requested timestamp',
    example: '2026-04-11T10:00:00.000Z',
    nullable: true,
  })
  requestedAt!: Date | null;

  @ApiProperty({
    description: 'Processed timestamp',
    example: '2026-04-11T10:05:00.000Z',
    nullable: true,
  })
  processedAt!: Date | null;

  @ApiProperty({
    description: 'Refunded timestamp',
    example: '2026-04-11T10:10:00.000Z',
    nullable: true,
  })
  refundedAt!: Date | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-04-11T09:59:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Update timestamp',
    example: '2026-04-11T10:10:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Linked transaction summary kept for backward compatibility',
    type: RefundTransactionSnapshotDto,
    nullable: true,
  })
  transaction!: RefundTransactionSnapshotDto | null;

  @ApiProperty({
    description: 'Normalized transaction snapshot for admin read models',
    type: RefundTransactionSnapshotDto,
    nullable: true,
  })
  transactionSnapshot!: RefundTransactionSnapshotDto | null;

  @ApiProperty({
    description: 'Normalized admin operational snapshot',
    type: RefundAdminOperationalSnapshotDto,
    nullable: true,
  })
  adminOperationalSnapshot!: RefundAdminOperationalSnapshotDto | null;
}