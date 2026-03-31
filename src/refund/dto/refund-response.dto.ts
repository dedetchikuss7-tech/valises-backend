import { ApiProperty } from '@nestjs/swagger';
import { RefundProvider, RefundStatus } from '@prisma/client';

export class RefundResponseDto {
  @ApiProperty({
    description: 'Refund ID',
    example: 'e8f7d4c3-6b70-4d4f-86c8-8df1d5a1d002',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction ID linked to this refund',
    example: '7c79fd4d-2d7c-4b26-b98d-3cf7d08d0001',
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
    example: 5000,
  })
  amount!: number;

  @ApiProperty({
    description: 'Refund currency',
    example: 'XAF',
  })
  currency!: string;

  @ApiProperty({
    description: 'Provider external reference when available',
    example: 'rf_123456789',
    nullable: true,
  })
  externalReference!: string | null;

  @ApiProperty({
    description: 'Failure reason when refund failed',
    example: 'Provider timeout',
    nullable: true,
  })
  failureReason!: string | null;

  @ApiProperty({
    description: 'Provider or business metadata',
    example: {
      createdFrom: 'refund.request',
      reason: null,
      referenceId: null,
    },
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Idempotency key used for refund orchestration',
    example: 'refund_request:7c79fd4d-2d7c-4b26-b98d-3cf7d08d0001',
  })
  idempotencyKey!: string;

  @ApiProperty({
    description: 'Refund creation timestamp',
    example: '2026-04-01T09:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Refund last update timestamp',
    example: '2026-04-01T09:35:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Timestamp when refund was requested from provider',
    example: '2026-04-01T09:31:00.000Z',
    nullable: true,
  })
  requestedAt!: Date | null;

  @ApiProperty({
    description: 'Timestamp when refund processing started or was marked processed',
    example: '2026-04-01T09:32:00.000Z',
    nullable: true,
  })
  processedAt!: Date | null;

  @ApiProperty({
    description: 'Timestamp when refund was marked refunded',
    example: '2026-04-01T09:40:00.000Z',
    nullable: true,
  })
  refundedAt!: Date | null;
}