import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ResolveDisputeDto {
  @IsString()
  decidedById!: string;

  @IsIn(['REFUND_SENDER', 'RELEASE_TO_TRAVELER', 'SPLIT', 'REJECT'])
  outcome!: 'REFUND_SENDER' | 'RELEASE_TO_TRAVELER' | 'SPLIT' | 'REJECT';

  @IsIn(['NONE', 'BASIC', 'STRONG'])
  evidenceLevel!: 'NONE' | 'BASIC' | 'STRONG';

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