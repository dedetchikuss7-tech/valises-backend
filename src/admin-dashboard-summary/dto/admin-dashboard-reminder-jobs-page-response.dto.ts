import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardPageResponseBaseDto } from './admin-dashboard-page-response-base.dto';
import { AdminDashboardActionableReminderJobQueueItemDto } from './admin-dashboard-queues-response.dto';

export class AdminDashboardReminderJobsPageResponseDto extends AdminDashboardPageResponseBaseDto {
  @ApiProperty({
    type: AdminDashboardActionableReminderJobQueueItemDto,
    isArray: true,
  })
  items!: AdminDashboardActionableReminderJobQueueItemDto[];
}