import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DisputeOpeningSource, DisputeReasonCode } from '@prisma/client';

export class GetAdminDashboardOpenDisputesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(['createdAt', 'reasonCode', 'openingSource'])
  sortBy?: 'createdAt' | 'reasonCode' | 'openingSource';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(Object.values(DisputeReasonCode))
  reasonCode?: DisputeReasonCode;

  @IsOptional()
  @IsIn(Object.values(DisputeOpeningSource))
  openingSource?: DisputeOpeningSource;
}