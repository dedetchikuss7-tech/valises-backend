import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DisputeEvidenceItemStatus } from '@prisma/client';

export class ReviewDisputeEvidenceItemDto {
  @IsEnum(DisputeEvidenceItemStatus)
  status!: DisputeEvidenceItemStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}