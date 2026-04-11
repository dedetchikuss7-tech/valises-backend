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

class DashboardCountsDto {
  @ApiProperty({ example: 3 })
  openDisputesCount!: number;

  @ApiProperty({ example: 2 })
  requestedPayoutsCount!: number;

  @ApiProperty({ example: 1 })
  processingPayoutsCount!: number;

  @ApiProperty({ example: 4 })
  requestedRefundsCount!: number;

  @ApiProperty({ example: 1 })
  processingRefundsCount!: number;

  @ApiProperty({ example: 5 })
  transactionsRequiringAttentionCount!: number;

  @ApiProperty({ example: 6 })
  activeAbandonmentEventsCount!: number;

  @ApiProperty({ example: 7 })
  actionableReminderJobsCount!: number;
}

class RecentOpenDisputeDto {
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

class PendingPayoutDto {
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

class PendingRefundDto {
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

class ActionableReminderJobDto {
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

  @ApiProperty({ example: 'KYC_PENDING' })
  abandonmentKind!: string | null;
}

class TransactionAttentionPreviewDto {
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

export class AdminDashboardSummaryResponseDto {
  @ApiProperty({ example: '2026-04-11T10:15:00.000Z' })
  serverTime!: string;

  @ApiProperty({ example: 5 })
  previewLimit!: number;

  @ApiProperty({ type: DashboardCountsDto })
  counts!: DashboardCountsDto;

  @ApiProperty({
    type: RecentOpenDisputeDto,
    isArray: true,
  })
  recentOpenDisputes!: RecentOpenDisputeDto[];

  @ApiProperty({
    type: PendingPayoutDto,
    isArray: true,
  })
  pendingPayouts!: PendingPayoutDto[];

  @ApiProperty({
    type: PendingRefundDto,
    isArray: true,
  })
  pendingRefunds!: PendingRefundDto[];

  @ApiProperty({
    type: ActionableReminderJobDto,
    isArray: true,
  })
  actionableReminderJobs!: ActionableReminderJobDto[];

  @ApiProperty({
    type: TransactionAttentionPreviewDto,
    isArray: true,
  })
  transactionsRequiringAttentionPreview!: TransactionAttentionPreviewDto[];
}