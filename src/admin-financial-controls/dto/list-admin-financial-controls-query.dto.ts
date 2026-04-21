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

export enum AdminFinancialControlStatus {
  CLEAN = 'CLEAN',
  WARNING = 'WARNING',
  BREACH = 'BREACH',
}

export class ListAdminFinancialControlsQueryDto {
  @ApiPropertyOptional({
    enum: AdminFinancialControlStatus,
    description: 'Optional derived control status filter',
  })
  @IsOptional()
  @IsEnum(AdminFinancialControlStatus)
  status?: AdminFinancialControlStatus;

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
    description: 'Only rows requiring action',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresAction?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of control rows to return',
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