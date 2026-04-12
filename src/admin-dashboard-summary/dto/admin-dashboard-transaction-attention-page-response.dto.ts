import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardTransactionAttentionQueueItemDto } from './admin-dashboard-queues-response.dto';

export class AdminDashboardTransactionAttentionPageResponseDto {
  @ApiProperty({
    type: AdminDashboardTransactionAttentionQueueItemDto,
    isArray: true,
  })
  items!: AdminDashboardTransactionAttentionQueueItemDto[];

  @ApiProperty({ example: 10 })
  count!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: true })
  hasMore!: boolean;
}