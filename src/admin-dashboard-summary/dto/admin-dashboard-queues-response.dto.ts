import { ApiProperty } from '@nestjs/swagger';
import {
  DisputeOpeningSource,
  DisputeReasonCode,
  DisputeStatus,
  PayoutStatus,
  RefundStatus,
  ReminderChannel,
  ReminderJobStatus,
  TransactionStatus,
} from '@prisma/client';

export class AdminDashboardTransactionAttentionQueueItemDto {
  @ApiProperty({ example: 'tx_123' })
  transactionId!: string;

  @ApiProperty({
    enum: TransactionStatus,
    example: TransactionStatus.DISPUTED,
    nullable: true,
  })
  status!: TransactionStatus | null;

  @ApiProperty({ example: true })
  hasOpenDispute!: boolean;

  @ApiProperty({ example: true })
  hasRequestedPayout!: boolean;

  @ApiProperty({ example: false })
  hasRequestedRefund!: boolean;
}

export class AdminDashboardOpenDisputeQueueItemDto {
  @ApiProperty({ example: 'dp_123' })
  id!: string;

  @ApiProperty({ example: 'tx_123' })
  transactionId!: string;

  @ApiProperty({
    enum: DisputeReasonCode,
    example: DisputeReasonCode.NOT_DELIVERED,
  })
  reasonCode!: DisputeReasonCode;

  @ApiProperty({
    enum: DisputeOpeningSource,
    example: DisputeOpeningSource.MANUAL,
  })
  openingSource!: DisputeOpeningSource;

  @ApiProperty({
    enum: DisputeStatus,
    example: DisputeStatus.OPEN,
  })
  status!: DisputeStatus;

  @ApiProperty({ example: '2026-04-11T10:00:00.000Z' })
  createdAt!: Date;
}

export class AdminDashboardPendingPayoutQueueItemDto {
  @ApiProperty({ example: 'po_123' })
  id!: string;

  @ApiProperty({ example: 'tx_123' })
  transactionId!: string;

  @ApiProperty({
    enum: PayoutStatus,
    example: PayoutStatus.REQUESTED,
  })
  status!: PayoutStatus;

  @ApiProperty({ example: 1000 })
  amount!: number;

  @ApiProperty({ example: 'XAF' })
  currency!: string;

  @ApiProperty({ example: '2026-04-11T10:00:00.000Z' })
  createdAt!: Date;
}

export class AdminDashboardPendingRefundQueueItemDto {
  @ApiProperty({ example: 'rf_123' })
  id!: string;

  @ApiProperty({ example: 'tx_123' })
  transactionId!: string;

  @ApiProperty({
    enum: RefundStatus,
    example: RefundStatus.REQUESTED,
  })
  status!: RefundStatus;

  @ApiProperty({ example: 400 })
  amount!: number;

  @ApiProperty({ example: 'XAF' })
  currency!: string;

  @ApiProperty({ example: '2026-04-11T10:00:00.000Z' })
  createdAt!: Date;
}

export class AdminDashboardActionableReminderJobQueueItemDto {
  @ApiProperty({ example: 'job_123' })
  id!: string;

  @ApiProperty({ example: 'event_123' })
  abandonmentEventId!: string;

  @ApiProperty({
    enum: ReminderJobStatus,
    example: ReminderJobStatus.PENDING,
  })
  status!: ReminderJobStatus;

  @ApiProperty({
    enum: ReminderChannel,
    example: ReminderChannel.EMAIL,
  })
  channel!: ReminderChannel;

  @ApiProperty({ example: '2026-04-11T10:00:00.000Z' })
  scheduledFor!: Date;

  @ApiProperty({ example: 'KYC_PENDING', nullable: true })
  abandonmentKind!: string | null;
}