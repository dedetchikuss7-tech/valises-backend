import { IsIn, IsOptional } from 'class-validator';
import { DisputeOpeningSource, DisputeReasonCode } from '@prisma/client';
import { AdminDashboardPaginationQueryDto } from './admin-dashboard-pagination-query.dto';

export class GetAdminDashboardOpenDisputesQueryDto extends AdminDashboardPaginationQueryDto {
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