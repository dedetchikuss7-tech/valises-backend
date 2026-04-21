import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum NotificationCategory {
  TRANSACTION = 'TRANSACTION',
  DISPUTE = 'DISPUTE',
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
  AML = 'AML',
  TRUST = 'TRUST',
  LEGAL = 'LEGAL',
  SYSTEM = 'SYSTEM',
  OPS = 'OPS',
}

export enum NotificationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export class ListMyNotificationsQueryDto {
  @ApiPropertyOptional({
    enum: NotificationCategory,
    description: 'Optional notification category filter',
  })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @ApiPropertyOptional({
    enum: NotificationSeverity,
    description: 'Optional severity filter',
  })
  @IsOptional()
  @IsEnum(NotificationSeverity)
  severity?: NotificationSeverity;

  @ApiPropertyOptional({
    description: 'Only unread notifications',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Optional context type filter',
  })
  @IsOptional()
  @IsString()
  contextType?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of notifications to return',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}