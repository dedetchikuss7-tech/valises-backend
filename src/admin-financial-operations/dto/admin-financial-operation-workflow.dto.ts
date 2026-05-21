import { ApiProperty } from '@nestjs/swagger';

export enum AdminFinancialWorkflowStatus {
  READY = 'READY',
  MONITORING = 'MONITORING',
  BLOCKED = 'BLOCKED',
  ESCALATED = 'ESCALATED',
  COMPLETED = 'COMPLETED',
}

export class AdminFinancialOperationWorkflowDto {
  @ApiProperty({
    enum: AdminFinancialWorkflowStatus,
  })
  workflowStatus!: AdminFinancialWorkflowStatus;

  @ApiProperty({
    type: [String],
  })
  activeStages!: string[];

  @ApiProperty({
    type: [String],
  })
  completedStages!: string[];

  @ApiProperty({
    type: [String],
  })
  pendingStages!: string[];

  @ApiProperty()
  requiresHumanAction!: boolean;

  @ApiProperty()
  operationallyBlocked!: boolean;

  @ApiProperty()
  summary!: string;
}