import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DisputeEvidenceStatus } from '@prisma/client';

export class UpdateDisputeAdminDossierDto {
  @IsOptional()
  @IsString()
  customerStatement?: string;

  @IsOptional()
  @IsString()
  travelerStatement?: string;

  @IsOptional()
  @IsString()
  evidenceSummary?: string;

  @IsOptional()
  @IsString()
  adminAssessment?: string;

  @IsOptional()
  @IsEnum(DisputeEvidenceStatus)
  evidenceStatus?: DisputeEvidenceStatus;
}