import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardPageResponseBaseDto } from './admin-dashboard-page-response-base.dto';
import { AdminDashboardPendingRefundQueueItemDto } from './admin-dashboard-queues-response.dto';

export class AdminDashboardRefundsPageResponseDto extends AdminDashboardPageResponseBaseDto {
  @ApiProperty({ type: AdminDashboardPendingRefundQueueItemDto, isArray: true })
  items!: AdminDashboardPendingRefundQueueItemDto[];
}