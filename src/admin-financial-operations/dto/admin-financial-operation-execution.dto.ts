import { ApiProperty } from '@nestjs/swagger';

export enum FinancialOperationExecutionUrgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum FinancialOperationExecutionOwner {
  FINANCE_OPERATIONS = 'FINANCE_OPERATIONS',
  RISK_TEAM = 'RISK_TEAM',
  SUPPORT_TEAM = 'SUPPORT_TEAM',
  ENGINEERING = 'ENGINEERING',
  AUTOMATION = 'AUTOMATION',
}

export enum FinancialOperationExecutionAction {
  NO_ACTION = 'NO_ACTION',
  MONITOR_OPERATION = 'MONITOR_OPERATION',
  RETRY_PROVIDER_CALL = 'RETRY_PROVIDER_CALL',
  CONTACT_PROVIDER_SUPPORT = 'CONTACT_PROVIDER_SUPPORT',
  MANUAL_LEDGER_REVIEW = 'MANUAL_LEDGER_REVIEW',
  FREEZE_FUNDS = 'FREEZE_FUNDS',
  ESCALATE_TO_RISK_TEAM = 'ESCALATE_TO_RISK_TEAM',
  WAIT_PROVIDER_CONFIRMATION = 'WAIT_PROVIDER_CONFIRMATION',
}

export class AdminFinancialOperationExecutionDto {
  @ApiProperty({
    enum: FinancialOperationExecutionAction,
  })
  recommendedAction!: FinancialOperationExecutionAction;

  @ApiProperty({
    enum: FinancialOperationExecutionOwner,
  })
  operationalOwner!: FinancialOperationExecutionOwner;

  @ApiProperty({
    enum: FinancialOperationExecutionUrgency,
  })
  urgency!: FinancialOperationExecutionUrgency;

  @ApiProperty()
  requiresImmediateAction!: boolean;

  @ApiProperty()
  targetResolutionMinutes!: number;

  @ApiProperty({
    type: [String],
  })
  blockingDependencies!: string[];

  @ApiProperty()
  nextStep!: string;

  @ApiProperty()
  executionSummary!: string;
}