import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum AdminCaseSourceType {
  AML = 'AML',
  DISPUTE = 'DISPUTE',
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
  ABANDONMENT = 'ABANDONMENT',
}

export enum AdminCaseDerivedStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export class ListAdminCaseManagementQueryDto {
  @ApiPropertyOptional({
    enum: AdminCaseSourceType,
    description: 'Optional source type filter',
  })
  @IsOptional()
  @IsEnum(AdminCaseSourceType)
  sourceType?: AdminCaseSourceType;

  @ApiPropertyOptional({
    enum: AdminCaseDerivedStatus,
    description: 'Optional derived status filter',
  })
  @IsOptional()
  @IsEnum(AdminCaseDerivedStatus)
  status?: AdminCaseDerivedStatus;

  @ApiPropertyOptional({
    description: 'Optional assigned admin filter',
  })
  @IsOptional()
  @IsString()
  assignedAdminId?: string;

  @ApiPropertyOptional({
    description: 'Optional subject user filter',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Optional transaction filter',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Only cases requiring action',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresAction?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of cases to return',
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