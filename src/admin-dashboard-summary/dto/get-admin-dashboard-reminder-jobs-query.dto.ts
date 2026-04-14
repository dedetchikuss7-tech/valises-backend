import { IsIn, IsOptional } from 'class-validator';
import { ReminderChannel, ReminderJobStatus } from '@prisma/client';
import { AdminDashboardPaginationQueryDto } from './admin-dashboard-pagination-query.dto';

export class GetAdminDashboardReminderJobsQueryDto extends AdminDashboardPaginationQueryDto {
  @IsOptional()
  @IsIn(['scheduledFor', 'status', 'channel'])
  sortBy?: 'scheduledFor' | 'status' | 'channel';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(Object.values(ReminderJobStatus))
  status?: ReminderJobStatus;

  @IsOptional()
  @IsIn(Object.values(ReminderChannel))
  channel?: ReminderChannel;
}