import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const NOTIFICATION_OUTBOX_CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'PUSH'] as const;
export const NOTIFICATION_OUTBOX_STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'] as const;

export type NotificationOutboxChannel = (typeof NOTIFICATION_OUTBOX_CHANNELS)[number];
export type NotificationOutboxStatus = (typeof NOTIFICATION_OUTBOX_STATUSES)[number];

export class ListNotificationOutboxQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_OUTBOX_CHANNELS })
  @IsOptional()
  @IsIn(NOTIFICATION_OUTBOX_CHANNELS)
  channel?: NotificationOutboxChannel;

  @ApiPropertyOptional({ enum: NOTIFICATION_OUTBOX_STATUSES })
  @IsOptional()
  @IsIn(NOTIFICATION_OUTBOX_STATUSES)
  status?: NotificationOutboxStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dueOnly?: boolean;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}