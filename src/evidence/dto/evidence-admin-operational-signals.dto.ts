import { ApiProperty } from '@nestjs/swagger';

export enum EvidenceReviewPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum EvidenceReviewReason {
  PENDING_REVIEW = 'PENDING_REVIEW',
  REVIEW_OVERDUE = 'REVIEW_OVERDUE',
  REVIEW_OLD = 'REVIEW_OLD',
  STORAGE_INCOMPLETE = 'STORAGE_INCOMPLETE',
  STORAGE_COMPLETE = 'STORAGE_COMPLETE',
  REJECTED_ATTACHMENT = 'REJECTED_ATTACHMENT',
  ACCEPTED_ATTACHMENT = 'ACCEPTED_ATTACHMENT',
}

export enum EvidenceRecommendedAction {
  REVIEW_ATTACHMENT = 'REVIEW_ATTACHMENT',
  PRIORITIZE_REVIEW = 'PRIORITIZE_REVIEW',
  REQUEST_RESUBMISSION = 'REQUEST_RESUBMISSION',
  NO_ACTION_REQUIRED = 'NO_ACTION_REQUIRED',
}

export enum EvidenceStorageCompletenessStatus {
  COMPLETE = 'COMPLETE',
  PARTIAL = 'PARTIAL',
  LEGACY_FILE_URL_ONLY = 'LEGACY_FILE_URL_ONLY',
  MISSING = 'MISSING',
}

export class EvidenceAdminOperationalSignalsDto {
  @ApiProperty({
    description: 'Age of the evidence attachment in minutes',
    example: 180,
  })
  reviewAgeMinutes!: number;

  @ApiProperty({
    description:
      'Whether the pending review is overdue according to the admin operational threshold',
    example: false,
  })
  isReviewOverdue!: boolean;

  @ApiProperty({
    enum: EvidenceReviewPriority,
    example: EvidenceReviewPriority.MEDIUM,
  })
  reviewPriority!: EvidenceReviewPriority;

  @ApiProperty({
    enum: EvidenceReviewReason,
    isArray: true,
    example: [
      EvidenceReviewReason.PENDING_REVIEW,
      EvidenceReviewReason.STORAGE_COMPLETE,
    ],
  })
  reviewReasons!: EvidenceReviewReason[];

  @ApiProperty({
    enum: EvidenceRecommendedAction,
    example: EvidenceRecommendedAction.REVIEW_ATTACHMENT,
  })
  recommendedAction!: EvidenceRecommendedAction;

  @ApiProperty({
    enum: EvidenceStorageCompletenessStatus,
    example: EvidenceStorageCompletenessStatus.COMPLETE,
  })
  storageCompletenessStatus!: EvidenceStorageCompletenessStatus;
}