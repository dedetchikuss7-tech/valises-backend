import { ApiProperty } from '@nestjs/swagger';

export enum TransactionOperationalConsistencySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TransactionOperationalConsistencySignalCode {
  OPEN_DISPUTE_AFTER_DELIVERY = 'OPEN_DISPUTE_AFTER_DELIVERY',
  PAYOUT_WITH_OPEN_DISPUTE = 'PAYOUT_WITH_OPEN_DISPUTE',
  PAYOUT_WITH_PENDING_EVIDENCE = 'PAYOUT_WITH_PENDING_EVIDENCE',
  REFUND_WITHOUT_DISPUTE_OR_RESTRICTION = 'REFUND_WITHOUT_DISPUTE_OR_RESTRICTION',
  DELIVERED_WITHOUT_ACCEPTED_DELIVERY_PROOF = 'DELIVERED_WITHOUT_ACCEPTED_DELIVERY_PROOF',
  DELIVERY_PROOF_REJECTED_AFTER_DELIVERY = 'DELIVERY_PROOF_REJECTED_AFTER_DELIVERY',
  PAID_TRANSACTION_WITHOUT_PAYMENT_SUCCESS = 'PAID_TRANSACTION_WITHOUT_PAYMENT_SUCCESS',
  RELEASE_READY_BUT_PAYMENT_NOT_SUCCESS = 'RELEASE_READY_BUT_PAYMENT_NOT_SUCCESS',
  OPERATIONAL_CASE_DONE_WITH_ESCALATION_REQUIRED = 'OPERATIONAL_CASE_DONE_WITH_ESCALATION_REQUIRED',
  CLAIMED_OR_ACTIVE_CASE_WITHOUT_OWNER = 'CLAIMED_OR_ACTIVE_CASE_WITHOUT_OWNER',
  RESOLUTION_READY_WITH_PENDING_EVIDENCE = 'RESOLUTION_READY_WITH_PENDING_EVIDENCE',
  ESCALATION_REQUIRED_WITHOUT_OPERATIONAL_CASE = 'ESCALATION_REQUIRED_WITHOUT_OPERATIONAL_CASE',
}

export class TransactionOperationalConsistencySignalDto {
  @ApiProperty({
    enum: TransactionOperationalConsistencySignalCode,
  })
  code!: TransactionOperationalConsistencySignalCode;

  @ApiProperty({
    enum: TransactionOperationalConsistencySeverity,
  })
  severity!: TransactionOperationalConsistencySeverity;

  @ApiProperty()
  message!: string;
}

export class AdminTransactionOperationalConsistencyDto {
  @ApiProperty()
  consistencyScore!: number;

  @ApiProperty()
  hasConsistencyIssue!: boolean;

  @ApiProperty()
  hasCriticalConsistencyIssue!: boolean;

  @ApiProperty({
    type: [TransactionOperationalConsistencySignalDto],
  })
  signals!: TransactionOperationalConsistencySignalDto[];

  @ApiProperty({
    type: [String],
  })
  summary!: string[];
}