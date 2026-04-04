import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import {
  DisputeEvidenceItemKind,
  DisputeEvidenceItemStatus,
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
  @IsEnum(DisputeEvidenceItemKind)
  evidenceKind?: DisputeEvidenceItemKind;

  @IsOptional()
  @IsEnum(DisputeEvidenceItemStatus)
  evidenceItemStatus?: DisputeEvidenceItemStatus;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  openedById?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  hasPendingEvidenceReview?: 'true' | 'false';

  @IsOptional()
  @IsIn(['true', 'false'])
  hasAcceptedEvidence?: 'true' | 'false';

  @IsOptional()
  @IsIn(['true', 'false'])
  hasRejectedEvidence?: 'true' | 'false';
}