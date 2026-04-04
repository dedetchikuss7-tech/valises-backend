import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResetDisputeEvidenceItemReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}