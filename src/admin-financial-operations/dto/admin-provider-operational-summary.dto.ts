import { ApiProperty } from '@nestjs/swagger';

export class AdminProviderOperationalSummaryItemDto {
  @ApiProperty()
  provider!: string;

  @ApiProperty()
  totalOperations!: number;

  @ApiProperty()
  failedOperations!: number;

  @ApiProperty()
  staleOperations!: number;

  @ApiProperty()
  requiresReview!: boolean;
}

export class AdminProviderOperationalSummaryDto {
  @ApiProperty()
  totalProviders!: number;

  @ApiProperty()
  providersRequiringReview!: number;

  @ApiProperty()
  totalFailedOperations!: number;

  @ApiProperty()
  totalStaleOperations!: number;

  @ApiProperty({
    type: [AdminProviderOperationalSummaryItemDto],
  })
  providers!: AdminProviderOperationalSummaryItemDto[];
}