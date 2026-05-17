import { ApiProperty } from '@nestjs/swagger';

export enum TransactionAutomationReadiness {
  READY = 'READY',
  HUMAN_REVIEW = 'HUMAN_REVIEW',
  BLOCKED = 'BLOCKED',
}

export enum TransactionAutomationBlockerCode {
  OPEN_DISPUTE = 'OPEN_DISPUTE',
  AML_ACTIVE = 'AML_ACTIVE',
  ACTIVE_RESTRICTION = 'ACTIVE_RESTRICTION',
  REJECTED_DELIVERY_PROOF = 'REJECTED_DELIVERY_PROOF',
  PENDING_EVIDENCE_REVIEW = 'PENDING_EVIDENCE_REVIEW',
  PENDING_REFUND = 'PENDING_REFUND',
  PENDING_PAYOUT = 'PENDING_PAYOUT',
  STALE_TRANSACTION = 'STALE_TRANSACTION',
  SLA_OVERDUE = 'SLA_OVERDUE',
}

export enum TransactionAutomationCandidateCode {
  AUTO_RELEASE_ESCROW = 'AUTO_RELEASE_ESCROW',
  AUTO_CLOSE_OPERATIONAL_CASE = 'AUTO_CLOSE_OPERATIONAL_CASE',
  AUTO_RESOLVE_LOW_RISK_REFUND = 'AUTO_RESOLVE_LOW_RISK_REFUND',
  AUTO_COMPLETE_TRANSACTION = 'AUTO_COMPLETE_TRANSACTION',
}

export class AdminTransactionOperationalAutomationDto {
  @ApiProperty({
    enum: TransactionAutomationReadiness,
  })
  readiness!: TransactionAutomationReadiness;

  @ApiProperty()
  confidenceScore!: number;

  @ApiProperty()
  requiresHumanReview!: boolean;

  @ApiProperty()
  adminOverrideRequired!: boolean;

  @ApiProperty({
    enum: TransactionAutomationBlockerCode,
    isArray: true,
  })
  blockers!: TransactionAutomationBlockerCode[];

  @ApiProperty({
    enum: TransactionAutomationCandidateCode,
    isArray: true,
  })
  candidates!: TransactionAutomationCandidateCode[];
}