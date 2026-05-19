import { ApiProperty } from '@nestjs/swagger';

export enum TransactionOperationalRiskBand {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TransactionOperationalUrgencyBand {
  ROUTINE = 'ROUTINE',
  PRIORITY = 'PRIORITY',
  URGENT = 'URGENT',
  IMMEDIATE = 'IMMEDIATE',
}

export enum TransactionHumanAttentionLevel {
  MINIMAL = 'MINIMAL',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  FULL_MANUAL = 'FULL_MANUAL',
}

export enum TransactionAutomationReadinessBand {
  READY = 'READY',
  PARTIAL = 'PARTIAL',
  BLOCKED = 'BLOCKED',
}

export class AdminTransactionOperationalCockpitDto {
  @ApiProperty()
  globalOperationalScore!: number;

  @ApiProperty({
    enum: TransactionOperationalRiskBand,
  })
  riskBand!: TransactionOperationalRiskBand;

  @ApiProperty({
    enum: TransactionOperationalUrgencyBand,
  })
  urgencyBand!: TransactionOperationalUrgencyBand;

  @ApiProperty({
    enum: TransactionHumanAttentionLevel,
  })
  humanAttentionLevel!: TransactionHumanAttentionLevel;

  @ApiProperty({
    enum: TransactionAutomationReadinessBand,
  })
  automationReadinessBand!: TransactionAutomationReadinessBand;

  @ApiProperty()
  executiveAttentionRequired!: boolean;

  @ApiProperty()
  operationalHealthSummary!: string;

  @ApiProperty({
    type: [String],
  })
  topOperationalSignals!: string[];

  @ApiProperty({
    type: [String],
  })
  topOperationalBlockers!: string[];
}