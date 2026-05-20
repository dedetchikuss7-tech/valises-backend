import { ApiProperty } from '@nestjs/swagger';

export enum AdminTransactionOperationalWorkflowStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  BLOCKED = 'BLOCKED',
}

export class AdminTransactionOperationalWorkflowTransitionDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  allowed: boolean;

  @ApiProperty({ type: [String] })
  blockers: string[];

  @ApiProperty({ type: [String] })
  warnings: string[];
}

export class AdminTransactionOperationalWorkflowDto {
  @ApiProperty({
    enum: AdminTransactionOperationalWorkflowStatus,
  })
  status: AdminTransactionOperationalWorkflowStatus;

  @ApiProperty()
  workflowScore: number;

  @ApiProperty()
  escalationRequired: boolean;

  @ApiProperty()
  ownershipConsistent: boolean;

  @ApiProperty()
  resolutionAllowed: boolean;

  @ApiProperty()
  releaseAllowed: boolean;

  @ApiProperty({ type: [String] })
  blockers: string[];

  @ApiProperty({ type: [String] })
  warnings: string[];

  @ApiProperty({
    type: [AdminTransactionOperationalWorkflowTransitionDto],
  })
  allowedTransitions: AdminTransactionOperationalWorkflowTransitionDto[];

  @ApiProperty({
    type: [AdminTransactionOperationalWorkflowTransitionDto],
  })
  forbiddenTransitions: AdminTransactionOperationalWorkflowTransitionDto[];
}