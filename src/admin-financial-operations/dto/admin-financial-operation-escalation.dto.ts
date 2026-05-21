import { ApiProperty } from '@nestjs/swagger';

export enum FinancialOperationEscalationLevel {
  NORMAL = 'NORMAL',
  WATCH = 'WATCH',
  ESCALATED = 'ESCALATED',
  CRITICAL = 'CRITICAL',
}

export class AdminFinancialOperationEscalationDto {
  @ApiProperty({
    enum: FinancialOperationEscalationLevel,
  })
  escalationLevel!: FinancialOperationEscalationLevel;

  @ApiProperty()
  slaBreached!: boolean;

  @ApiProperty()
  stuckOperation!: boolean;

  @ApiProperty()
  requiresImmediateAttention!: boolean;

  @ApiProperty({
    type: [String],
  })
  escalationReasons!: string[];

  @ApiProperty()
  operationAgeMinutes!: number;

  @ApiProperty()
  summary!: string;
}