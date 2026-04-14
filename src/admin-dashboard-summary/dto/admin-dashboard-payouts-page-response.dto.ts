import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardPageResponseBaseDto } from './admin-dashboard-page-response-base.dto';
import { AdminDashboardPendingPayoutQueueItemDto } from './admin-dashboard-queues-response.dto';

export class AdminDashboardPayoutsPageResponseDto extends AdminDashboardPageResponseBaseDto {
  @ApiProperty({ type: AdminDashboardPendingPayoutQueueItemDto, isArray: true })
  items!: AdminDashboardPendingPayoutQueueItemDto[];
}