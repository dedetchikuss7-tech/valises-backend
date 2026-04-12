import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardOpenDisputeQueueItemDto } from './admin-dashboard-queues-response.dto';

export class AdminDashboardOpenDisputesPageResponseDto {
  @ApiProperty({ type: AdminDashboardOpenDisputeQueueItemDto, isArray: true })
  items!: AdminDashboardOpenDisputeQueueItemDto[];

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