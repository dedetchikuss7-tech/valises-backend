import { ApiProperty } from '@nestjs/swagger';

export enum FinancialOperationSlaStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  BREACHED = 'BREACHED',
  CRITICAL = 'CRITICAL',
}

export class AdminFinancialOperationSlaDto {
  @ApiProperty({
    enum: FinancialOperationSlaStatus,
  })
  status!: FinancialOperationSlaStatus;

  @ApiProperty()
  slaBreached!: boolean;

  @ApiProperty()
  expectedResolutionMinutes!: number;

  @ApiProperty()
  elapsedMinutes!: number;

  @ApiProperty()
  remainingMinutes!: number;

  @ApiProperty()
  requiresUrgentIntervention!: boolean;

  @ApiProperty()
  agingBucket!: string;

  @ApiProperty()
  summary!: string;
}