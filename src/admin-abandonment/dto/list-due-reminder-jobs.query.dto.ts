import { Type } from 'class-transformer';
import { ReminderChannel } from '@prisma/client';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListDueReminderJobsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter due reminder jobs by channel',
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