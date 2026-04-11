import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DisputeOutcome, EvidenceLevel } from '@prisma/client';

export class BulkDashboardResolveDisputesDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsEnum(DisputeOutcome)
  outcome!: DisputeOutcome;

  @IsEnum(EvidenceLevel)
  evidenceLevel!: EvidenceLevel;

  @IsOptional()
  @IsInt()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  releaseAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}