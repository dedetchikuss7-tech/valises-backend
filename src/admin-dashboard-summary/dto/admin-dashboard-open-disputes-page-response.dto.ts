import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardPageResponseBaseDto } from './admin-dashboard-page-response-base.dto';
import { AdminDashboardOpenDisputeQueueItemDto } from './admin-dashboard-queues-response.dto';

export class AdminDashboardOpenDisputesPageResponseDto extends AdminDashboardPageResponseBaseDto {
  @ApiProperty({ type: AdminDashboardOpenDisputeQueueItemDto, isArray: true })
  items!: AdminDashboardOpenDisputeQueueItemDto[];
}