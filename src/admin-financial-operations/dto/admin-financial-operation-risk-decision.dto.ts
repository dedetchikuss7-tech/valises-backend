import { ApiProperty } from '@nestjs/swagger';

export enum FinancialOperationRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum FinancialOperationRiskDecision {
  MONITOR = 'MONITOR',
  REVIEW = 'REVIEW',
  ESCALATE = 'ESCALATE',
  HOLD = 'HOLD',
}

export class AdminFinancialOperationRiskDecisionDto {
  @ApiProperty({ enum: FinancialOperationRiskLevel })
  riskLevel!: FinancialOperationRiskLevel;

  @ApiProperty({ enum: FinancialOperationRiskDecision })
  decision!: FinancialOperationRiskDecision;

  @ApiProperty()
  riskScore!: number;

  @ApiProperty()
  automationCandidate!: boolean;

  @ApiProperty()
  blocksAutomation!: boolean;

  @ApiProperty()
  requiresSeniorReview!: boolean;

  @ApiProperty({ type: [String] })
  decisionReasons!: string[];

  @ApiProperty()
  summary!: string;
}