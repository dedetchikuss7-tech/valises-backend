import { ApiProperty } from '@nestjs/swagger';

export enum DisputeOrchestrationStatus {
  HEALTHY = 'HEALTHY',
  WAITING_EVIDENCE = 'WAITING_EVIDENCE',
  WAITING_ADMIN_REVIEW = 'WAITING_ADMIN_REVIEW',
  READY_FOR_RESOLUTION = 'READY_FOR_RESOLUTION',
  FINANCIAL_EXECUTION_PENDING = 'FINANCIAL_EXECUTION_PENDING',
  BLOCKED = 'BLOCKED',
  CLOSED = 'CLOSED',
}

export enum DisputeResolutionReadiness {
  NOT_READY = 'NOT_READY',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  READY = 'READY',
  ALREADY_RESOLVED = 'ALREADY_RESOLVED',
}

export enum DisputeEscalationLevel {
  NONE = 'NONE',
  WATCH = 'WATCH',
  ESCALATED = 'ESCALATED',
  CRITICAL = 'CRITICAL',
}

export enum DisputePriorityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum DisputeOperationalOwner {
  AUTOMATION = 'AUTOMATION',
  SUPPORT = 'SUPPORT',
  ADMIN = 'ADMIN',
  FINANCE = 'FINANCE',
  COMPLIANCE = 'COMPLIANCE',
}

export enum DisputeQueueCategory {
  WAITING_CUSTOMER = 'WAITING_CUSTOMER',
  WAITING_ADMIN = 'WAITING_ADMIN',
  READY_FOR_RESOLUTION = 'READY_FOR_RESOLUTION',
  FINANCIAL_EXECUTION = 'FINANCIAL_EXECUTION',
  HIGH_RISK = 'HIGH_RISK',
  CLOSED_OPERATIONALLY = 'CLOSED_OPERATIONALLY',
}

export class DisputeOrchestrationDto {
  @ApiProperty({ enum: DisputeOrchestrationStatus })
  orchestrationStatus!: DisputeOrchestrationStatus;

  @ApiProperty({ enum: DisputeResolutionReadiness })
  resolutionReadiness!: DisputeResolutionReadiness;

  @ApiProperty({ enum: DisputeEscalationLevel })
  escalationLevel!: DisputeEscalationLevel;

  @ApiProperty({ enum: DisputePriorityLevel })
  priorityLevel!: DisputePriorityLevel;

  @ApiProperty({ enum: DisputeOperationalOwner })
  operationalOwner!: DisputeOperationalOwner;

  @ApiProperty({ enum: DisputeQueueCategory })
  queueCategory!: DisputeQueueCategory;

  @ApiProperty()
  slaBreached!: boolean;

  @ApiProperty()
  requiresImmediateEscalation!: boolean;

  @ApiProperty()
  lifecycleConsistency!: boolean;

  @ApiProperty()
  payoutConsistency!: boolean;

  @ApiProperty()
  refundConsistency!: boolean;

  @ApiProperty()
  disputeHealthScore!: number;

  @ApiProperty({ type: [String] })
  blockingReasons!: string[];

  @ApiProperty({ type: [String] })
  recommendedNextActions!: string[];

  @ApiProperty()
  operationalSummary!: string;
}