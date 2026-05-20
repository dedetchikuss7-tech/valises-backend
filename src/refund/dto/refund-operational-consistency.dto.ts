import { ApiProperty } from '@nestjs/swagger';

export class RefundOperationalConsistencyDto {
  @ApiProperty({
    description:
      'Whether refund amount exceeds current transaction escrow balance',
    example: false,
  })
  exceedsEscrowBalance!: boolean;

  @ApiProperty({
    description:
      'Whether transaction payment status is inconsistent with refund flow',
    example: false,
  })
  paymentStatusMismatch!: boolean;

  @ApiProperty({
    description:
      'Whether payout/refund orchestration overlap creates operational risk',
    example: true,
  })
  conflictingFinancialFlows!: boolean;

  @ApiProperty({
    description:
      'Whether refund state appears inconsistent with transaction lifecycle',
    example: false,
  })
  transactionLifecycleMismatch!: boolean;

  @ApiProperty({
    description:
      'Whether the refund requires immediate manual investigation',
    example: true,
  })
  requiresManualInvestigation!: boolean;

  @ApiProperty({
    description:
      'Human-readable operational consistency summary',
    example:
      'Refund overlaps with active payout orchestration and requires manual review.',
  })
  summary!: string;
}