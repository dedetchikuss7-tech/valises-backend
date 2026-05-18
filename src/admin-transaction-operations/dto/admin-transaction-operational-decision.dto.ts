import { ApiProperty } from '@nestjs/swagger';

export enum TransactionOperationalDecisionStatus {
  ALLOWED = 'ALLOWED',
  BLOCKED = 'BLOCKED',
  REQUIRED = 'REQUIRED',
  NOT_REQUIRED = 'NOT_REQUIRED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

export enum TransactionOperationalDecisionBlockerCode {
  PAYMENT_NOT_CONFIRMED = 'PAYMENT_NOT_CONFIRMED',
  DELIVERY_NOT_CONFIRMED = 'DELIVERY_NOT_CONFIRMED',
  OPEN_DISPUTE = 'OPEN_DISPUTE',
  PENDING_EVIDENCE_REVIEW = 'PENDING_EVIDENCE_REVIEW',
  PENDING_DELIVERY_EVIDENCE_REVIEW = 'PENDING_DELIVERY_EVIDENCE_REVIEW',
  REJECTED_DELIVERY_PROOF = 'REJECTED_DELIVERY_PROOF',
  ACTIVE_USER_RESTRICTION = 'ACTIVE_USER_RESTRICTION',
  AML_CASE_ACTIVE = 'AML_CASE_ACTIVE',
  PENDING_PAYOUT = 'PENDING_PAYOUT',
  PENDING_REFUND = 'PENDING_REFUND',
  SLA_OVERDUE = 'SLA_OVERDUE',
  REQUIRES_ESCALATION = 'REQUIRES_ESCALATION',
}

export enum TransactionOperationalDecisionAction {
  RELEASE_FUNDS = 'RELEASE_FUNDS',
  EXECUTE_REFUND = 'EXECUTE_REFUND',
  CLOSE_OPERATIONAL_CASE = 'CLOSE_OPERATIONAL_CASE',
  ESCALATE_OPERATIONAL_CASE = 'ESCALATE_OPERATIONAL_CASE',
  REQUEST_MORE_EVIDENCE = 'REQUEST_MORE_EVIDENCE',
  MARK_READY_FOR_AUTOMATION = 'MARK_READY_FOR_AUTOMATION',
}

export class TransactionOperationalDecisionRuleDto {
  @ApiProperty({
    enum: TransactionOperationalDecisionAction,
  })
  action!: TransactionOperationalDecisionAction;

  @ApiProperty({
    enum: TransactionOperationalDecisionStatus,
  })
  status!: TransactionOperationalDecisionStatus;

  @ApiProperty()
  allowed!: boolean;

  @ApiProperty()
  requiresHumanApproval!: boolean;

  @ApiProperty({
    enum: TransactionOperationalDecisionBlockerCode,
    isArray: true,
  })
  blockers!: TransactionOperationalDecisionBlockerCode[];

  @ApiProperty({
    type: [String],
  })
  reasons!: string[];
}

export class AdminTransactionOperationalDecisionMatrixDto {
  @ApiProperty()
  hasBlockingDecision!: boolean;

  @ApiProperty()
  hasRequiredEscalation!: boolean;

  @ApiProperty()
  safeToAutoProgress!: boolean;

  @ApiProperty({
    type: [TransactionOperationalDecisionRuleDto],
  })
  rules!: TransactionOperationalDecisionRuleDto[];
}