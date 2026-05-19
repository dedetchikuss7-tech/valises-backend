import { ApiProperty } from '@nestjs/swagger';

export enum TransactionOperationalOwnershipProfile {
  GENERALIST = 'GENERALIST',
  DISPUTE_SPECIALIST = 'DISPUTE_SPECIALIST',
  DELIVERY_SPECIALIST = 'DELIVERY_SPECIALIST',
  FINANCIAL_OPERATIONS = 'FINANCIAL_OPERATIONS',
  COMPLIANCE_ANALYST = 'COMPLIANCE_ANALYST',
  TRUST_AND_SAFETY = 'TRUST_AND_SAFETY',
  EXECUTIVE_REVIEWER = 'EXECUTIVE_REVIEWER',
}

export enum TransactionOperationalOwnershipSeniority {
  JUNIOR = 'JUNIOR',
  CONFIRMED = 'CONFIRMED',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
}

export class AdminTransactionOperationalOwnershipDto {
  @ApiProperty({
    enum: TransactionOperationalOwnershipProfile,
  })
  recommendedPrimaryOwner!: TransactionOperationalOwnershipProfile;

  @ApiProperty({
    enum: TransactionOperationalOwnershipSeniority,
  })
  recommendedSeniority!: TransactionOperationalOwnershipSeniority;

  @ApiProperty({
    type: [String],
  })
  supportingTeams!: string[];

  @ApiProperty()
  requiresCrossTeamCoordination!: boolean;

  @ApiProperty()
  requiresSeniorValidation!: boolean;

  @ApiProperty({
    type: [String],
  })
  ownershipReasons!: string[];
}