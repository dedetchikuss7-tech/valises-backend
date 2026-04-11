import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardActivityItemDto {
  @ApiProperty({ example: 'audit_123' })
  id!: string;

  @ApiProperty({ example: 'DISPUTE_RESOLVED' })
  action!: string;

  @ApiProperty({ example: 'DISPUTE' })
  targetType!: string;

  @ApiProperty({ example: 'dp_123', nullable: true })
  targetId!: string | null;

  @ApiProperty({ example: 'user_123', nullable: true })
  actorUserId!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-04-11T10:00:00.000Z' })
  createdAt!: Date;
}