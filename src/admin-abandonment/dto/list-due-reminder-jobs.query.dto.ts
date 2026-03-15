import { Type } from 'class-transformer';
import { ReminderChannel } from '@prisma/client';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDueReminderJobsQueryDto {
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