import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReminderChannel, ReminderJobStatus } from '@prisma/client';

export class GetAdminDashboardReminderJobsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

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