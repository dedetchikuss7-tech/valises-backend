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

export enum AdminFinancialOperationObjectType {
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
  FINANCIAL_CONTROL = 'FINANCIAL_CONTROL',
}

export enum AdminFinancialOperationPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum AdminFinancialOperationRecommendedAction {
  PROCESS_PAYOUT = 'PROCESS_PAYOUT',
  MONITOR_PAYOUT = 'MONITOR_PAYOUT',
  RETRY_PAYOUT = 'RETRY_PAYOUT',
  PROCESS_REFUND = 'PROCESS_REFUND',
  MONITOR_REFUND = 'MONITOR_REFUND',
  RETRY_REFUND = 'RETRY_REFUND',
  REVIEW_FINANCIAL_CONTROL = 'REVIEW_FINANCIAL_CONTROL',
  NO_ACTION_REQUIRED = 'NO_ACTION_REQUIRED',
}

export enum AdminFinancialOperationsSortBy {
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  AGE_MINUTES = 'AGE_MINUTES',
  PRIORITY = 'PRIORITY',
  AMOUNT = 'AMOUNT',
}

export enum AdminFinancialOperationsSortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListAdminFinancialOperationsQueryDto {
  @ApiPropertyOptional({
    enum: AdminFinancialOperationObjectType,
    description: 'Filter by operation object type',
  })
  @IsOptional()
  @IsEnum(AdminFinancialOperationObjectType)
  objectType?: AdminFinancialOperationObjectType;

  @ApiPropertyOptional({
    enum: AdminFinancialOperationPriority,
    description: 'Filter by computed priority',
  })
  @IsOptional()
  @IsEnum(AdminFinancialOperationPriority)
  priority?: AdminFinancialOperationPriority;

  @ApiPropertyOptional({
    description: 'Only operations requiring admin action',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresAction?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by transaction id',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Filter by sender or traveler user id',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Free-text search across ids, statuses, currency, reasons and actions',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: AdminFinancialOperationsSortBy,
    default: AdminFinancialOperationsSortBy.PRIORITY,
  })
  @IsOptional()
  @IsEnum(AdminFinancialOperationsSortBy)
  sortBy?: AdminFinancialOperationsSortBy =
    AdminFinancialOperationsSortBy.PRIORITY;

  @ApiPropertyOptional({
    enum: AdminFinancialOperationsSortOrder,
    default: AdminFinancialOperationsSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(AdminFinancialOperationsSortOrder)
  sortOrder?: AdminFinancialOperationsSortOrder =
    AdminFinancialOperationsSortOrder.DESC;

  @ApiPropertyOptional({
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}