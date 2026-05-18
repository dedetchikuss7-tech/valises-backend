import { ApiProperty } from '@nestjs/swagger';

export enum TransactionOperationalExecutableAction {
  REVIEW_DISPUTE = 'REVIEW_DISPUTE',
  REVIEW_EVIDENCE = 'REVIEW_EVIDENCE',
  REVIEW_DELIVERY_PROOF = 'REVIEW_DELIVERY_PROOF',
  REQUEST_MORE_EVIDENCE = 'REQUEST_MORE_EVIDENCE',
  ESCALATE_OPERATIONAL_CASE = 'ESCALATE_OPERATIONAL_CASE',
  MONITOR_PAYOUT = 'MONITOR_PAYOUT',
  MONITOR_REFUND = 'MONITOR_REFUND',
  RELEASE_FUNDS = 'RELEASE_FUNDS',
  RESOLVE_OPERATIONAL_CASE = 'RESOLVE_OPERATIONAL_CASE',
  CLOSE_OPERATIONAL_CASE = 'CLOSE_OPERATIONAL_CASE',
}

export enum TransactionOperationalExecutionConfidence {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TransactionOperationalExecutionBlockerSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TransactionOperationalExecutionPrerequisiteStatus {
  MET = 'MET',
  MISSING = 'MISSING',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export class TransactionOperationalExecutionBlockerDto {
  @ApiProperty()
  code!: string;

  @ApiProperty({
    enum: TransactionOperationalExecutionBlockerSeverity,
  })
  severity!: TransactionOperationalExecutionBlockerSeverity;

  @ApiProperty()
  message!: string;
}

export class TransactionOperationalExecutionPrerequisiteDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({
    enum: TransactionOperationalExecutionPrerequisiteStatus,
  })
  status!: TransactionOperationalExecutionPrerequisiteStatus;
}

export class TransactionOperationalExecutableActionReadinessDto {
  @ApiProperty({
    enum: TransactionOperationalExecutableAction,
  })
  action!: TransactionOperationalExecutableAction;

  @ApiProperty()
  isExecutable!: boolean;

  @ApiProperty()
  requiresHumanApproval!: boolean;

  @ApiProperty({
    enum: TransactionOperationalExecutionConfidence,
  })
  confidence!: TransactionOperationalExecutionConfidence;

  @ApiProperty({
    type: [TransactionOperationalExecutionBlockerDto],
  })
  blockers!: TransactionOperationalExecutionBlockerDto[];

  @ApiProperty({
    type: [TransactionOperationalExecutionPrerequisiteDto],
  })
  prerequisites!: TransactionOperationalExecutionPrerequisiteDto[];

  @ApiProperty()
  reason!: string;
}

export class AdminTransactionOperationalExecutionReadinessDto {
  @ApiProperty()
  hasExecutableAction!: boolean;

  @ApiProperty()
  executableActionCount!: number;

  @ApiProperty()
  blockedActionCount!: number;

  @ApiProperty()
  humanApprovalRequiredCount!: number;

  @ApiProperty({
    enum: TransactionOperationalExecutionConfidence,
  })
  overallConfidence!: TransactionOperationalExecutionConfidence;

  @ApiProperty({
    type: [TransactionOperationalExecutableActionReadinessDto],
  })
  actions!: TransactionOperationalExecutableActionReadinessDto[];
}