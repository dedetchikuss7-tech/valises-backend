import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminWorkloadQueuePreset } from './list-admin-workload-queue-query.dto';

export enum AdminWorkloadDrilldownPreset {
  CRITICAL_OPEN = 'CRITICAL_OPEN',
  HIGH_URGENCY_OPEN = 'HIGH_URGENCY_OPEN',
  NEEDS_REVIEW_ATTENTION = 'NEEDS_REVIEW_ATTENTION',
  UNASSIGNED_OPEN = 'UNASSIGNED_OPEN',
  UNASSIGNED_OVERDUE = 'UNASSIGNED_OVERDUE',
  MY_OPEN = 'MY_OPEN',
  MY_OVERDUE = 'MY_OVERDUE',
  WAITING_EXTERNAL = 'WAITING_EXTERNAL',
  DUE_SOON = 'DUE_SOON',
  RECENTLY_TOUCHED = 'RECENTLY_TOUCHED',
  NO_RECENT_ACTION = 'NO_RECENT_ACTION',
}

export class AdminWorkloadDrilldownPresetResponseDto {
  @ApiProperty({ enum: AdminWorkloadDrilldownPreset })
  preset!: AdminWorkloadDrilldownPreset;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: AdminWorkloadQueuePreset })
  queuePreset!: AdminWorkloadQueuePreset;

  @ApiPropertyOptional({
    description:
      'Server-side filters applied by this drilldown preset. These are informational for the frontend.',
  })
  appliedFilters?: Record<string, unknown>;
}

export class AdminWorkloadDrilldownPresetListResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty({ type: [AdminWorkloadDrilldownPresetResponseDto] })
  items!: AdminWorkloadDrilldownPresetResponseDto[];
}