import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardBulkActionResultItemDto {
  @ApiProperty({ example: 'po_123' })
  id!: string;

  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    example: 'Payout marked as paid',
    nullable: true,
  })
  message!: string | null;

  @ApiProperty({
    example: 'Payout not found',
    nullable: true,
  })
  error!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  result!: Record<string, unknown> | null;
}

export class AdminDashboardBulkActionResultDto {
  @ApiProperty({ example: 3 })
  requestedCount!: number;

  @ApiProperty({ example: 2 })
  successCount!: number;

  @ApiProperty({ example: 1 })
  failureCount!: number;

  @ApiProperty({
    type: AdminDashboardBulkActionResultItemDto,
    isArray: true,
  })
  results!: AdminDashboardBulkActionResultItemDto[];
}