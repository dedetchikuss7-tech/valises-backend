import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdminFinancialOperationObjectType,
  AdminFinancialOperationPriority,
  AdminFinancialOperationRecommendedAction,
} from './list-admin-financial-operations-query.dto';
import { AdminFinancialOperationReadinessDto } from './admin-financial-operation-readiness.dto';
import { AdminFinancialOperationWorkflowDto } from './admin-financial-operation-workflow.dto';
import { AdminProviderEventNormalizationDto } from './admin-provider-event-normalization.dto';
import { AdminFinancialOperationEscalationDto } from './admin-financial-operation-escalation.dto';

export class AdminFinancialOperationTransactionSnapshotDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  paymentStatus!: string;

  @ApiProperty()
  escrowAmount!: number;

  @ApiProperty({ nullable: true })
  senderId!: string | null;

  @ApiProperty({ nullable: true })
  travelerId!: string | null;

  @ApiProperty()
  currency!: string;
}

export class AdminFinancialOperationResponseDto {
  @ApiProperty({ enum: AdminFinancialOperationObjectType })
  objectType!: AdminFinancialOperationObjectType;

  @ApiProperty()
  objectId!: string;

  @ApiProperty()
  transactionId!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: AdminFinancialOperationPriority })
  priority!: AdminFinancialOperationPriority;

  @ApiProperty()
  requiresAction!: boolean;

  @ApiProperty({ enum: AdminFinancialOperationRecommendedAction })
  recommendedAction!: AdminFinancialOperationRecommendedAction;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiProperty()
  ageMinutes!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  updatedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  provider?: string | null;

  @ApiPropertyOptional({ nullable: true })
  railProvider?: string | null;

  @ApiPropertyOptional({ nullable: true })
  methodType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  externalReference?: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureReason?: string | null;

  @ApiProperty({
    type: AdminFinancialOperationTransactionSnapshotDto,
    nullable: true,
  })
  transactionSnapshot!: AdminFinancialOperationTransactionSnapshotDto | null;

  @ApiProperty({
    type: AdminFinancialOperationReadinessDto,
    nullable: true,
  })
  operationalReadiness!: AdminFinancialOperationReadinessDto | null;

  @ApiProperty({
    type: AdminFinancialOperationWorkflowDto,
    nullable: true,
  })
  operationalWorkflow!: AdminFinancialOperationWorkflowDto | null;

  @ApiProperty({
    type: AdminProviderEventNormalizationDto,
    nullable: true,
  })
  providerEventNormalization!: AdminProviderEventNormalizationDto | null;

  @ApiProperty({
    type: AdminFinancialOperationEscalationDto,
    nullable: true,
  })
  escalation!: AdminFinancialOperationEscalationDto | null;

  @ApiProperty({ nullable: true })
  metadata!: Record<string, unknown> | null;
}