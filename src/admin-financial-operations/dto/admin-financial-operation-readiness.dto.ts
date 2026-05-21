import { ApiProperty } from '@nestjs/swagger';

export enum FinancialOperationReadinessStatus {
  READY = 'READY',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  BLOCKED = 'BLOCKED',
  ESCALATED = 'ESCALATED',
}

export class AdminFinancialOperationReadinessDto {
  @ApiProperty({
    enum: FinancialOperationReadinessStatus,
  })
  status!: FinancialOperationReadinessStatus;

  @ApiProperty({
    type: [String],
  })
  blockers!: string[];

  @ApiProperty({
    type: [String],
  })
  warnings!: string[];

  @ApiProperty()
  canExecute!: boolean;

  @ApiProperty()
  requiresEscalation!: boolean;

  @ApiProperty()
  requiresManualReview!: boolean;

  @ApiProperty()
  summary!: string;
}