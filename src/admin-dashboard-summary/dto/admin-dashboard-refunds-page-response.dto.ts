import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardPendingRefundQueueItemDto } from './admin-dashboard-queues-response.dto';

export class AdminDashboardRefundsPageResponseDto {
  @ApiProperty({ type: AdminDashboardPendingRefundQueueItemDto, isArray: true })
  items!: AdminDashboardPendingRefundQueueItemDto[];

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