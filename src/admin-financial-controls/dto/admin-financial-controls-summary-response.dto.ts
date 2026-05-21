import { ApiProperty } from '@nestjs/swagger';

export class AdminFinancialControlsSummaryResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  cleanRows!: number;

  @ApiProperty()
  warningRows!: number;

  @ApiProperty()
  breachRows!: number;

  @ApiProperty()
  requiresActionCount!: number;

  @ApiProperty()
  totalTransactionAmount!: number;

  @ApiProperty()
  totalLedgerCreditedAmount!: number;

  @ApiProperty()
  totalLedgerReleasedAmount!: number;

  @ApiProperty()
  totalLedgerRefundedAmount!: number;

  @ApiProperty()
  totalPayoutPaidAmount!: number;

  @ApiProperty()
  totalRefundPaidAmount!: number;

  @ApiProperty()
  totalRemainingEscrowAmount!: number;

  @ApiProperty()
  overSettlementCount!: number;

  @ApiProperty()
  missingLedgerCoverageCount!: number;

  @ApiProperty()
  escrowImbalanceCount!: number;

  @ApiProperty()
  requiresImmediateAttentionCount!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'number',
    },
  })
  mismatchSignalCounts!: Record<string, number>;
}