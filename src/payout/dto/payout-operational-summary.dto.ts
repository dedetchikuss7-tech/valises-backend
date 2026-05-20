import { ApiProperty } from '@nestjs/swagger';

export class PayoutOperationalSummaryDto {
  @ApiProperty({
    example: true,
  })
  payoutRequested!: boolean;

  @ApiProperty({
    example: false,
  })
  payoutFailed!: boolean;

  @ApiProperty({
    example: false,
  })
  retryRecommended!: boolean;

  @ApiProperty({
    example: true,
  })
  manualReviewRecommended!: boolean;

  @ApiProperty({
    example: false,
  })
  escalationRequired!: boolean;

  @ApiProperty({
    example: 'MEDIUM',
  })
  operationalRiskLevel!: string;

  @ApiProperty({
    example: true,
  })
  ownershipRequired!: boolean;

  @ApiProperty({
    example: 'FINANCE_OPERATIONS',
  })
  recommendedOwner!: string | null;
}