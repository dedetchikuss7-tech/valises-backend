import { Type } from 'class-transformer';
import { ReminderChannel, ReminderJobStatus } from '@prisma/client';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListReminderJobsQueryDto {
  @IsOptional()
  @IsString()
  abandonmentEventId?: string;

  @IsOptional()
  @IsString()
  status?: ReminderJobStatus | string;

  @IsOptional()
  @IsString()
  channel?: ReminderChannel | string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}