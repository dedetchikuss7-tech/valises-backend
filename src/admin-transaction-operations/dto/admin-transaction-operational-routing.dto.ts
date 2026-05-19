import { ApiProperty } from '@nestjs/swagger';

export enum TransactionOperationalRoutingTeam {
  GENERAL_OPERATIONS = 'GENERAL_OPERATIONS',
  DISPUTE_OPERATIONS = 'DISPUTE_OPERATIONS',
  DELIVERY_OPERATIONS = 'DELIVERY_OPERATIONS',
  FINANCIAL_OPERATIONS = 'FINANCIAL_OPERATIONS',
  COMPLIANCE = 'COMPLIANCE',
  TRUST_AND_SAFETY = 'TRUST_AND_SAFETY',
  EXECUTIVE_REVIEW = 'EXECUTIVE_REVIEW',
}

export enum TransactionOperationalRoutingUrgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class AdminTransactionOperationalRoutingDto {
  @ApiProperty({
    enum: TransactionOperationalRoutingTeam,
  })
  recommendedTeam!: TransactionOperationalRoutingTeam;

  @ApiProperty({
    enum: TransactionOperationalRoutingUrgency,
  })
  urgency!: TransactionOperationalRoutingUrgency;

  @ApiProperty()
  requiresImmediateAttention!: boolean;

  @ApiProperty({
    type: [String],
  })
  routingReasons!: string[];
}