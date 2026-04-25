import { ApiProperty } from '@nestjs/swagger';

export enum AdminWorkloadSlaStatus {
  NONE = 'NONE',
  OK = 'OK',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
  CLOSED = 'CLOSED',
}

export enum AdminWorkloadUrgencyLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AdminWorkloadUrgencyReason {
  NO_SLA = 'NO_SLA',
  SLA_OK = 'SLA_OK',
  SLA_DUE_SOON = 'SLA_DUE_SOON',
  SLA_OVERDUE = 'SLA_OVERDUE',
  UNASSIGNED_OPEN = 'UNASSIGNED_OPEN',
  UNASSIGNED_OVERDUE = 'UNASSIGNED_OVERDUE',
  CLAIMED = 'CLAIMED',
  IN_REVIEW = 'IN_REVIEW',
  WAITING_EXTERNAL = 'WAITING_EXTERNAL',
  DONE = 'DONE',
  RELEASED = 'RELEASED',
}

export enum AdminWorkloadRecommendedAction {
  NONE = 'NONE',
  CLAIM = 'CLAIM',
  CLAIM_AND_REVIEW = 'CLAIM_AND_REVIEW',
  REVIEW_SOON = 'REVIEW_SOON',
  REVIEW_NOW = 'REVIEW_NOW',
  FOLLOW_UP_EXTERNAL = 'FOLLOW_UP_EXTERNAL',
  CLOSE_IF_RESOLVED = 'CLOSE_IF_RESOLVED',
}

export class AdminWorkloadUrgencyDto {
  @ApiProperty({ enum: AdminWorkloadSlaStatus })
  slaStatus!: AdminWorkloadSlaStatus;

  @ApiProperty({ enum: AdminWorkloadUrgencyLevel })
  urgencyLevel!: AdminWorkloadUrgencyLevel;

  @ApiProperty({ enum: AdminWorkloadUrgencyReason, isArray: true })
  urgencyReasons!: AdminWorkloadUrgencyReason[];

  @ApiProperty({ enum: AdminWorkloadRecommendedAction })
  recommendedAction!: AdminWorkloadRecommendedAction;
}