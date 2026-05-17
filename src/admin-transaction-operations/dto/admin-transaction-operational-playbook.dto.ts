import { ApiProperty } from '@nestjs/swagger';

export enum TransactionOperationalReadinessStatus {
  READY = 'READY',
  MONITORING = 'MONITORING',
  NEEDS_ADMIN_REVIEW = 'NEEDS_ADMIN_REVIEW',
  BLOCKED = 'BLOCKED',
}

export enum TransactionOperationalPlaybookCode {
  REVIEW_DISPUTE_EVIDENCE = 'REVIEW_DISPUTE_EVIDENCE',
  REVIEW_DELIVERY_PROOF = 'REVIEW_DELIVERY_PROOF',
  RECONCILE_PAYOUT = 'RECONCILE_PAYOUT',
  RECONCILE_REFUND = 'RECONCILE_REFUND',
  REVIEW_RESTRICTION_RISK = 'REVIEW_RESTRICTION_RISK',
  ESCALATE_STALE_CASE = 'ESCALATE_STALE_CASE',
  CLOSE_OPERATIONAL_CASE = 'CLOSE_OPERATIONAL_CASE',
  MONITOR_ONLY = 'MONITOR_ONLY',
}

export enum TransactionOperationalAutomationCandidateCode {
  REQUEST_EVIDENCE_REVIEW = 'REQUEST_EVIDENCE_REVIEW',
  REQUEST_DELIVERY_PROOF = 'REQUEST_DELIVERY_PROOF',
  RECONCILE_PAYOUT_PROVIDER = 'RECONCILE_PAYOUT_PROVIDER',
  RECONCILE_REFUND_PROVIDER = 'RECONCILE_REFUND_PROVIDER',
  ESCALATE_SLA_BREACH = 'ESCALATE_SLA_BREACH',
  CLOSE_LOW_RISK_CASE = 'CLOSE_LOW_RISK_CASE',
}

export enum TransactionOperationalAdminBlockerCode {
  PAYMENT_NOT_CONFIRMED = 'PAYMENT_NOT_CONFIRMED',
  OPEN_DISPUTE = 'OPEN_DISPUTE',
  PENDING_EVIDENCE_REVIEW = 'PENDING_EVIDENCE_REVIEW',
  PENDING_DELIVERY_EVIDENCE_REVIEW = 'PENDING_DELIVERY_EVIDENCE_REVIEW',
  REJECTED_DELIVERY_PROOF = 'REJECTED_DELIVERY_PROOF',
  ACTIVE_USER_RESTRICTION = 'ACTIVE_USER_RESTRICTION',
  PENDING_PAYOUT = 'PENDING_PAYOUT',
  PENDING_REFUND = 'PENDING_REFUND',
  SLA_OVERDUE = 'SLA_OVERDUE',
  REQUIRES_ESCALATION = 'REQUIRES_ESCALATION',
}

export enum TransactionOperationalChecklistItemStatus {
  PENDING = 'PENDING',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export class TransactionOperationalChecklistItemDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({
    enum: TransactionOperationalChecklistItemStatus,
  })
  status!: TransactionOperationalChecklistItemStatus;

  @ApiProperty()
  isRequired!: boolean;

  @ApiProperty()
  reason!: string;
}

export class TransactionOperationalPlaybookResponseDto {
  @ApiProperty()
  transactionId!: string;

  @ApiProperty({
    enum: TransactionOperationalReadinessStatus,
  })
  readinessStatus!: TransactionOperationalReadinessStatus;

  @ApiProperty({
    enum: TransactionOperationalPlaybookCode,
  })
  playbookCode!: TransactionOperationalPlaybookCode;

  @ApiProperty()
  playbookTitle!: string;

  @ApiProperty()
  playbookSummary!: string;

  @ApiProperty({
    enum: TransactionOperationalAdminBlockerCode,
    isArray: true,
  })
  adminBlockers!: TransactionOperationalAdminBlockerCode[];

  @ApiProperty({
    enum: TransactionOperationalAutomationCandidateCode,
    isArray: true,
  })
  automationCandidates!: TransactionOperationalAutomationCandidateCode[];

  @ApiProperty({
    type: [String],
  })
  nextBestAdminActions!: string[];

  @ApiProperty({
    type: [TransactionOperationalChecklistItemDto],
  })
  checklist!: TransactionOperationalChecklistItemDto[];

  @ApiProperty()
  canBeOperationallyClosed!: boolean;

  @ApiProperty()
  shouldEscalate!: boolean;

  @ApiProperty()
  generatedAt!: Date;
}