import { ApiProperty } from '@nestjs/swagger';
import { PayoutProvider, PayoutStatus } from '@prisma/client';

export class PayoutResponseDto {
  @ApiProperty({
    description: 'Payout ID',
    example: 'd7e6d4c3-6b70-4d4f-86c8-8df1d5a1d001',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction ID linked to this payout',
    example: '7c79fd4d-2d7c-4b26-b98d-3cf7d08d0001',
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
    example: 10000,
  })
  amount!: number;

  @ApiProperty({
    description: 'Payout currency',
    example: 'XAF',
  })
  currency!: string;

  @ApiProperty({
    description: 'Provider external reference when available',
    example: 'po_123456789',
    nullable: true,
  })
  externalReference!: string | null;

  @ApiProperty({
    description: 'Failure reason when payout failed',
    example: 'Provider timeout',
    nullable: true,
  })
  failureReason!: string | null;

  @ApiProperty({
    description: 'Provider or business metadata',
    example: {
      createdFrom: 'payout.request',
      reason: null,
      referenceId: null,
    },
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Idempotency key used for payout orchestration',
    example: 'payout_request:7c79fd4d-2d7c-4b26-b98d-3cf7d08d0001',
  })
  idempotencyKey!: string;

  @ApiProperty({
    description: 'Payout creation timestamp',
    example: '2026-04-01T09:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Payout last update timestamp',
    example: '2026-04-01T09:35:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Timestamp when payout was requested from provider',
    example: '2026-04-01T09:31:00.000Z',
    nullable: true,
  })
  requestedAt!: Date | null;

  @ApiProperty({
    description: 'Timestamp when payout processing started or was marked processed',
    example: '2026-04-01T09:32:00.000Z',
    nullable: true,
  })
  processedAt!: Date | null;

  @ApiProperty({
    description: 'Timestamp when payout was marked paid',
    example: '2026-04-01T09:40:00.000Z',
    nullable: true,
  })
  paidAt!: Date | null;
}