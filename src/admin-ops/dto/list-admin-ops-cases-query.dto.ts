import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum AdminOpsCaseType {
  AML = 'AML',
  DISPUTE = 'DISPUTE',
  RESTRICTION = 'RESTRICTION',
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
  ABANDONMENT = 'ABANDONMENT',
}

export class ListAdminOpsCasesQueryDto {
  @ApiPropertyOptional({
    enum: AdminOpsCaseType,
    description: 'Optional case type filter',
  })
  @IsOptional()
  @IsEnum(AdminOpsCaseType)
  caseType?: AdminOpsCaseType;

  @ApiPropertyOptional({
    description: 'Optional status filter',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Optional user filter',
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
    description: 'Free-text search across titles, subtitles, tags, ids and related ids',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Only actionable cases',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresAction?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of consolidated cases to return',
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

  @ApiPropertyOptional({
    description: 'Number of items to skip before returning results',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}