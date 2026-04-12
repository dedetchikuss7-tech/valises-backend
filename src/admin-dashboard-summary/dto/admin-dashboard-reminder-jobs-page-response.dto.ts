import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardActionableReminderJobQueueItemDto } from './admin-dashboard-queues-response.dto';

export class AdminDashboardReminderJobsPageResponseDto {
  @ApiProperty({
    type: AdminDashboardActionableReminderJobQueueItemDto,
    isArray: true,
  })
  items!: AdminDashboardActionableReminderJobQueueItemDto[];

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