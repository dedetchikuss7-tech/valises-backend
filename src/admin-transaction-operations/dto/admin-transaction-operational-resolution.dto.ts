import { ApiProperty } from '@nestjs/swagger';

export enum TransactionOperationalSuggestedResolution {
  NO_ACTION_REQUIRED = 'NO_ACTION_REQUIRED',
  REQUEST_DELIVERY_PROOF = 'REQUEST_DELIVERY_PROOF',
  REVIEW_DISPUTE = 'REVIEW_DISPUTE',
  REVIEW_EVIDENCE = 'REVIEW_EVIDENCE',
  ESCALATE_TO_SENIOR_REVIEW = 'ESCALATE_TO_SENIOR_REVIEW',
  HOLD_FOR_AML_REVIEW = 'HOLD_FOR_AML_REVIEW',
  HOLD_FOR_RESTRICTION_REVIEW = 'HOLD_FOR_RESTRICTION_REVIEW',
  MONITOR_PAYOUT = 'MONITOR_PAYOUT',
  MONITOR_REFUND = 'MONITOR_REFUND',
  CLOSE_OPERATIONAL_CASE = 'CLOSE_OPERATIONAL_CASE',
}

export enum TransactionOperationalResolutionBlockerCode {
  OPEN_DISPUTE = 'OPEN_DISPUTE',
  PENDING_EVIDENCE_REVIEW = 'PENDING_EVIDENCE_REVIEW',
  PENDING_DELIVERY_EVIDENCE_REVIEW = 'PENDING_DELIVERY_EVIDENCE_REVIEW',
  REJECTED_DELIVERY_PROOF = 'REJECTED_DELIVERY_PROOF',
  ACTIVE_USER_RESTRICTION = 'ACTIVE_USER_RESTRICTION',
  AML_CASE_ACTIVE = 'AML_CASE_ACTIVE',
  PENDING_PAYOUT = 'PENDING_PAYOUT',
  PENDING_REFUND = 'PENDING_REFUND',
  SLA_ESCALATION_REQUIRED = 'SLA_ESCALATION_REQUIRED',
}

export class AdminTransactionOperationalResolutionDto {
  @ApiProperty({ enum: TransactionOperationalSuggestedResolution })
  suggestedResolution!: TransactionOperationalSuggestedResolution;

  @ApiProperty()
  resolutionConfidenceScore!: number;

  @ApiProperty()
  canAutoResolve!: boolean;

  @ApiProperty()
  requiresSeniorApproval!: boolean;

  @ApiProperty()
  requiresHumanReview!: boolean;

  @ApiProperty({
    enum: TransactionOperationalResolutionBlockerCode,
    isArray: true,
  })
  resolutionBlockers!: TransactionOperationalResolutionBlockerCode[];

  @ApiProperty({ type: [String] })
  rationale!: string[];
}