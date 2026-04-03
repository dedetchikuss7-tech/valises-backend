import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  DisputeInitiatedBySide,
  DisputeOpeningSource,
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
  @IsString()
  transactionId?: string;
}