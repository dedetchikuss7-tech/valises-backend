import { ApiProperty } from '@nestjs/swagger';
import {
  DisputeStatus,
  PaymentStatus,
  PayoutProvider,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';

class PayoutTransactionSnapshotDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'tx_123',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction status',
    enum: TransactionStatus,
    example: TransactionStatus.DELIVERED,
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
    example: 1000,
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

class PayoutAdminOperationalSnapshotDto {
  @ApiProperty({
    description: 'Whether the transaction currently has an OPEN dispute',
    example: true,
  })
  hasOpenDispute!: boolean;

  @ApiProperty({
    description: 'Whether payout is currently requested or processing',
    example: true,
  })
  hasRequestedPayout!: boolean;

  @ApiProperty({
    description: 'Whether refund is currently requested or processing',
    example: false,
  })
  hasRequestedRefund!: boolean;

  @ApiProperty({
    description: 'High-level admin attention flag',
    example: true,
  })
  requiresAdminAttention!: boolean;
}

export class PayoutWithTransactionResponseDto {
  @ApiProperty({
    description: 'Payout ID',
    example: 'po_123',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction ID linked to this payout',
    example: 'tx_123',
  })
  transactionId!: string;

  @ApiProperty({
    description: 'Payout provider',
    enum: PayoutProvider,
    example: PayoutProvider.MANUAL,
  })
  provider!: PayoutProvider;

  @ApiProperty({
    description: 'Payout status',
    enum: PayoutStatus,
    example: PayoutStatus.REQUESTED,
  })
  status!: PayoutStatus;

  @ApiProperty({
    description: 'Payout amount',
    example: 1000,
  })
  amount!: number;

  @ApiProperty({
    description: 'Payout currency',
    example: 'XAF',
  })
  currency!: string;

  @ApiProperty({
    description: 'Provider-side external reference if present',
    example: 'manual-paid-001',
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
    description: 'Optional payout metadata',
    example: { reason: 'dispute_release' },
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
    description: 'Paid timestamp',
    example: '2026-04-11T10:10:00.000Z',
    nullable: true,
  })
  paidAt!: Date | null;

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
    type: PayoutTransactionSnapshotDto,
    nullable: true,
  })
  transaction!: PayoutTransactionSnapshotDto | null;

  @ApiProperty({
    description: 'Normalized transaction snapshot for admin read models',
    type: PayoutTransactionSnapshotDto,
    nullable: true,
  })
  transactionSnapshot!: PayoutTransactionSnapshotDto | null;

  @ApiProperty({
    description: 'Normalized admin operational snapshot',
    type: PayoutAdminOperationalSnapshotDto,
    nullable: true,
  })
  adminOperationalSnapshot!: PayoutAdminOperationalSnapshotDto | null;
}