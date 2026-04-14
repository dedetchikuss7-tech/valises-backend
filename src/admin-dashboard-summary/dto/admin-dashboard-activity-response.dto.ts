import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardActivityItemDto {
  @ApiProperty({
    description: 'Admin action audit entry ID',
    example: 'audit_123',
  })
  id!: string;

  @ApiProperty({
    description: 'Admin action code',
    example: 'DISPUTE_RESOLVED',
  })
  action!: string;

  @ApiProperty({
    description: 'Target entity type',
    example: 'DISPUTE',
    nullable: true,
  })
  targetType!: string | null;

  @ApiProperty({
    description: 'Target entity ID',
    example: 'dp_123',
    nullable: true,
  })
  targetId!: string | null;

  @ApiProperty({
    description: 'Actor user ID',
    example: 'user_123',
    nullable: true,
  })
  actorUserId!: string | null;

  @ApiProperty({
    description: 'Raw audit metadata',
    nullable: true,
    example: {
      transactionId: 'tx_123',
      requestedCount: 3,
      successCount: 2,
      failureCount: 1,
    },
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-04-12T10:15:30.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Human-friendly target label for ops display',
    example: 'DISPUTE dp_123',
    nullable: true,
  })
  targetLabel!: string | null;

  @ApiProperty({
    description: 'Human-friendly result summary derived from metadata',
    example: '2 succeeded, 1 failed',
    nullable: true,
  })
  resultSummary!: string | null;

  @ApiProperty({
    description: 'Whether this activity item represents a bulk action',
    example: true,
  })
  isBulkAction!: boolean;

  @ApiProperty({
    description: 'Batch size when this item is a bulk action',
    example: 3,
    nullable: true,
  })
  batchSize!: number | null;

  @ApiProperty({
    description: 'Bulk success count when available',
    example: 2,
    nullable: true,
  })
  successCount!: number | null;

  @ApiProperty({
    description: 'Bulk failure count when available',
    example: 1,
    nullable: true,
  })
  failureCount!: number | null;
}