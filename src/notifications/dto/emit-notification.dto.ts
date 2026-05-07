import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  NotificationCategory,
  NotificationSeverity,
} from './list-my-notifications-query.dto';

export const NOTIFICATION_CHANNELS = [
  'IN_APP',
  'EMAIL',
  'SMS',
  'PUSH',
] as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNELS)[number];

export class EmitNotificationDto {
  @ApiProperty()
  @IsString()
  recipientUserId!: string;

  @ApiPropertyOptional({
    description: 'Optional recipient role snapshot',
  })
  @IsOptional()
  @IsString()
  recipientRole?: string;

  @ApiProperty({ enum: NotificationCategory })
  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  @ApiProperty({ enum: NotificationSeverity })
  @IsEnum(NotificationSeverity)
  severity!: NotificationSeverity;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contextType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contextId?: string;

  @ApiPropertyOptional({
    description: 'Optional opaque metadata summary string',
  })
  @IsOptional()
  @IsString()
  metadataSummary?: string;

  @ApiPropertyOptional({
    enum: NOTIFICATION_CHANNELS,
    default: 'IN_APP',
  })
  @IsOptional()
  @IsEnum(NOTIFICATION_CHANNELS)
  channel?: NotificationChannel = 'IN_APP';
}