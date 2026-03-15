import { Type } from 'class-transformer';
import { ReminderChannel, ReminderJobStatus } from '@prisma/client';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListReminderJobsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by abandonment event ID',
    example: '04c6ef4f-980b-4cf7-9006-2ddba4003420',
  })
  @IsOptional()
  @IsString()
  abandonmentEventId?: string;

  @ApiPropertyOptional({
    description: 'Filter by reminder job status',
    enum: ReminderJobStatus,
    example: ReminderJobStatus.PENDING,
  })
  @IsOptional()
  @IsString()
  status?: ReminderJobStatus | string;

  @ApiPropertyOptional({
    description: 'Filter by reminder channel',
    enum: ReminderChannel,
    example: ReminderChannel.INTERNAL,
  })
  @IsOptional()
  @IsString()
  channel?: ReminderChannel | string;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return',
    minimum: 1,
    maximum: 200,
    default: 50,
    example: 20,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}