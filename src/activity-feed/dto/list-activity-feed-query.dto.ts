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

export enum ActivityFeedSourceType {
  TRANSACTION = 'TRANSACTION',
  DISPUTE = 'DISPUTE',
  AML = 'AML',
  RESTRICTION = 'RESTRICTION',
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
  NOTIFICATION = 'NOTIFICATION',
  CASE_MANAGEMENT = 'CASE_MANAGEMENT',
}

export enum ActivityFeedSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export class ListActivityFeedQueryDto {
  @ApiPropertyOptional({
    enum: ActivityFeedSourceType,
    description: 'Optional source type filter',
  })
  @IsOptional()
  @IsEnum(ActivityFeedSourceType)
  sourceType?: ActivityFeedSourceType;

  @ApiPropertyOptional({
    description: 'Optional transaction filter',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Optional user filter (admin endpoint only)',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    enum: ActivityFeedSeverity,
    description: 'Optional severity filter',
  })
  @IsOptional()
  @IsEnum(ActivityFeedSeverity)
  severity?: ActivityFeedSeverity;

  @ApiPropertyOptional({
    description: 'Include system-like events',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeSystem?: boolean = true;

  @ApiPropertyOptional({
    description: 'Maximum number of activity items to return',
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