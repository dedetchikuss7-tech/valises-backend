import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardPageResponseBaseDto } from './admin-dashboard-page-response-base.dto';
import { AdminDashboardTransactionAttentionQueueItemDto } from './admin-dashboard-queues-response.dto';

export class AdminDashboardTransactionAttentionPageResponseDto extends AdminDashboardPageResponseBaseDto {
  @ApiProperty({
    type: AdminDashboardTransactionAttentionQueueItemDto,
    isArray: true,
  })
  items!: AdminDashboardTransactionAttentionQueueItemDto[];
}