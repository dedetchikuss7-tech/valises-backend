import { ApiProperty } from '@nestjs/swagger';
import { TransactionAutomationReadiness } from './admin-transaction-operational-automation.dto';

export class AdminTransactionOperationalAutomationSummaryDto {
  @ApiProperty({
    enum: TransactionAutomationReadiness,
  })
  readiness!: TransactionAutomationReadiness;

  @ApiProperty()
  confidenceScore!: number;

  @ApiProperty()
  blockerCount!: number;

  @ApiProperty()
  candidateCount!: number;

  @ApiProperty()
  requiresHumanReview!: boolean;
}