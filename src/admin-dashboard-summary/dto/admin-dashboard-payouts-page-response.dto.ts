import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardPendingPayoutQueueItemDto } from './admin-dashboard-queues-response.dto';

export class AdminDashboardPayoutsPageResponseDto {
  @ApiProperty({ type: AdminDashboardPendingPayoutQueueItemDto, isArray: true })
  items!: AdminDashboardPendingPayoutQueueItemDto[];

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