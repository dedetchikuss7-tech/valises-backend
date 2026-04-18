import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AmlCaseStatus,
  AmlDecisionAction,
  AmlRiskLevel,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

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

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}