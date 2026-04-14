import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardPageResponseBaseDto } from './admin-dashboard-page-response-base.dto';
import { AdminDashboardActivityItemDto } from './admin-dashboard-activity-response.dto';

export class AdminDashboardActivityPageResponseDto extends AdminDashboardPageResponseBaseDto {
  @ApiProperty({ type: AdminDashboardActivityItemDto, isArray: true })
  items!: AdminDashboardActivityItemDto[];
}