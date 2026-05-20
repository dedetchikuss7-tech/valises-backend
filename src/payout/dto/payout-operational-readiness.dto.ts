import { ApiProperty } from '@nestjs/swagger';

export class PayoutOperationalBlockingIssueDto {
  @ApiProperty({
    example: 'OPEN_DISPUTE',
  })
  code!: string;

  @ApiProperty({
    example: 'Transaction has an active dispute',
  })
  message!: string;

  @ApiProperty({
    example: true,
  })
  blocking!: boolean;
}

export class PayoutOperationalReadinessDto {
  @ApiProperty({
    example: true,
  })
  ready!: boolean;

  @ApiProperty({
    example: false,
  })
  requiresManualReview!: boolean;

  @ApiProperty({
    example: 82,
  })
  confidenceScore!: number;

  @ApiProperty({
    type: [PayoutOperationalBlockingIssueDto],
  })
  issues!: PayoutOperationalBlockingIssueDto[];

  @ApiProperty({
    example: true,
  })
  payoutAllowed!: boolean;

  @ApiProperty({
    example: false,
  })
  refundConflict!: boolean;

  @ApiProperty({
    example: false,
  })
  disputeConflict!: boolean;

  @ApiProperty({
    example: false,
  })
  restrictionConflict!: boolean;
}