import { ApiProperty } from '@nestjs/swagger';
import { AdminDashboardActivityItemDto } from './admin-dashboard-activity-response.dto';

export class AdminDashboardActivityPageResponseDto {
  @ApiProperty({ type: AdminDashboardActivityItemDto, isArray: true })
  items!: AdminDashboardActivityItemDto[];

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