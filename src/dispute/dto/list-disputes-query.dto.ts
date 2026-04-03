import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import {
  DisputeEvidenceStatus,
  DisputeInitiatedBySide,
  DisputeOpeningSource,
  DisputeReasonCode,
  DisputeStatus,
  DisputeTriggeredByRole,
} from '@prisma/client';

export class ListDisputesQueryDto {
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @IsOptional()
  @IsEnum(DisputeOpeningSource)
  openingSource?: DisputeOpeningSource;

  @IsOptional()
  @IsEnum(DisputeInitiatedBySide)
  initiatedBySide?: DisputeInitiatedBySide;

  @IsOptional()
  @IsEnum(DisputeTriggeredByRole)
  triggeredByRole?: DisputeTriggeredByRole;

  @IsOptional()
  @IsEnum(DisputeEvidenceStatus)
  evidenceStatus?: DisputeEvidenceStatus;

  @IsOptional()
  @IsEnum(DisputeReasonCode)
  reasonCode?: DisputeReasonCode;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  openedById?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  hasPendingEvidenceReview?: 'true' | 'false';
}