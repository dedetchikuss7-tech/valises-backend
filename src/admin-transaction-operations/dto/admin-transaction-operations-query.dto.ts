import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, TransactionStatus } from '@prisma/client';
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
import {
  TransactionOperationalSeverity,
  TransactionRecommendedAction,
} from './admin-transaction-operation-item.dto';

export enum AdminTransactionOperationsSortBy {
  UPDATED_AT = 'UPDATED_AT',
  CREATED_AT = 'CREATED_AT',
  SEVERITY = 'SEVERITY',
  AMOUNT = 'AMOUNT',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class AdminTransactionOperationsQueryDto {
  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  transactionStatus?: TransactionStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: TransactionOperationalSeverity })
  @IsOptional()
  @IsEnum(TransactionOperationalSeverity)
  operationalSeverity?: TransactionOperationalSeverity;

  @ApiPropertyOptional({ enum: TransactionRecommendedAction })
  @IsOptional()
  @IsEnum(TransactionRecommendedAction)
  recommendedAction?: TransactionRecommendedAction;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresAdminAttention?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasOpenDispute?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasPendingEvidenceReview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasPendingRefund?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasPendingPayout?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasActiveRestriction?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: AdminTransactionOperationsSortBy,
    default: AdminTransactionOperationsSortBy.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminTransactionOperationsSortBy)
  sortBy?: AdminTransactionOperationsSortBy =
    AdminTransactionOperationsSortBy.UPDATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}