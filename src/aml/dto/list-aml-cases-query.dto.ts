import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AmlCaseStatus,
  AmlDecisionAction,
  AmlRiskLevel,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum AmlCasesSortBy {
  OPENED_AT = 'OPENED_AT',
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  RISK_LEVEL = 'RISK_LEVEL',
  CURRENT_ACTION = 'CURRENT_ACTION',
  SIGNAL_COUNT = 'SIGNAL_COUNT',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListAmlCasesQueryDto {
  @ApiPropertyOptional({ enum: AmlCaseStatus })
  @IsOptional()
  @IsEnum(AmlCaseStatus)
  status?: AmlCaseStatus;

  @ApiPropertyOptional({ enum: AmlDecisionAction })
  @IsOptional()
  @IsEnum(AmlDecisionAction)
  currentAction?: AmlDecisionAction;

  @ApiPropertyOptional({ enum: AmlRiskLevel })
  @IsOptional()
  @IsEnum(AmlRiskLevel)
  riskLevel?: AmlRiskLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Filter AML cases involving this sender or traveler',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Only AML cases requiring admin action',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresAction?: boolean;

  @ApiPropertyOptional({
    description: 'Free-text search across ids, actions, signals and summaries',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: AmlCasesSortBy,
    default: AmlCasesSortBy.OPENED_AT,
  })
  @IsOptional()
  @IsEnum(AmlCasesSortBy)
  sortBy?: AmlCasesSortBy = AmlCasesSortBy.OPENED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.DESC,
  })
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