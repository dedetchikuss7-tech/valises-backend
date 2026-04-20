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

export enum AdminReconciliationCaseType {
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
}

export enum AdminReconciliationDerivedStatus {
  CLEAN = 'CLEAN',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  MISMATCH = 'MISMATCH',
}

export class ListAdminReconciliationCasesQueryDto {
  @ApiPropertyOptional({
    enum: AdminReconciliationCaseType,
    description: 'Optional reconciliation type filter',
  })
  @IsOptional()
  @IsEnum(AdminReconciliationCaseType)
  caseType?: AdminReconciliationCaseType;

  @ApiPropertyOptional({
    enum: AdminReconciliationDerivedStatus,
    description: 'Optional derived reconciliation status filter',
  })
  @IsOptional()
  @IsEnum(AdminReconciliationDerivedStatus)
  status?: AdminReconciliationDerivedStatus;

  @ApiPropertyOptional({
    description: 'Optional transaction filter',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Optional user filter',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Only rows requiring reconciliation action',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresAction?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of reconciliation rows to return',
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