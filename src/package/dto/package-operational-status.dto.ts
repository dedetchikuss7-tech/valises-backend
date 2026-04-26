import { ApiProperty } from '@nestjs/swagger';

export enum PackageHandoverStatus {
  NOT_DECLARED = 'NOT_DECLARED',
  DECLARED = 'DECLARED',
}

export enum PackageTravelerResponsibilityStatus {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  PENDING = 'PENDING',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
}

export enum PackageOperationalReadinessStatus {
  DRAFT_INCOMPLETE = 'DRAFT_INCOMPLETE',
  READY_TO_PUBLISH = 'READY_TO_PUBLISH',
  PUBLISHED_WAITING_MATCH = 'PUBLISHED_WAITING_MATCH',
  RESERVED_WAITING_HANDOVER = 'RESERVED_WAITING_HANDOVER',
  RESERVED_WAITING_TRAVELER_ACK = 'RESERVED_WAITING_TRAVELER_ACK',
  READY_FOR_TRANSPORT = 'READY_FOR_TRANSPORT',
  CANCELLED = 'CANCELLED',
  BLOCKED_CONTENT = 'BLOCKED_CONTENT',
}

export enum PackageOperationalReadinessReason {
  PACKAGE_IS_DRAFT = 'PACKAGE_IS_DRAFT',
  PACKAGE_IS_PUBLISHED = 'PACKAGE_IS_PUBLISHED',
  PACKAGE_IS_RESERVED = 'PACKAGE_IS_RESERVED',
  PACKAGE_IS_CANCELLED = 'PACKAGE_IS_CANCELLED',
  CONTENT_NOT_DECLARED = 'CONTENT_NOT_DECLARED',
  CONTENT_BLOCKED = 'CONTENT_BLOCKED',
  CONTENT_DECLARED_CLEAR = 'CONTENT_DECLARED_CLEAR',
  CONTENT_DECLARED_SENSITIVE = 'CONTENT_DECLARED_SENSITIVE',
  HANDOVER_NOT_DECLARED = 'HANDOVER_NOT_DECLARED',
  HANDOVER_DECLARED = 'HANDOVER_DECLARED',
  TRAVELER_RESPONSIBILITY_PENDING = 'TRAVELER_RESPONSIBILITY_PENDING',
  TRAVELER_RESPONSIBILITY_ACKNOWLEDGED = 'TRAVELER_RESPONSIBILITY_ACKNOWLEDGED',
  READY_FOR_PUBLICATION = 'READY_FOR_PUBLICATION',
  READY_FOR_MATCHING = 'READY_FOR_MATCHING',
  READY_FOR_TRANSPORT = 'READY_FOR_TRANSPORT',
}

export class PackageOperationalStatusDto {
  @ApiProperty({ enum: PackageHandoverStatus })
  handoverStatus!: PackageHandoverStatus;

  @ApiProperty({ enum: PackageTravelerResponsibilityStatus })
  travelerResponsibilityStatus!: PackageTravelerResponsibilityStatus;

  @ApiProperty({ enum: PackageOperationalReadinessStatus })
  packageOperationalReadiness!: PackageOperationalReadinessStatus;

  @ApiProperty({
    enum: PackageOperationalReadinessReason,
    isArray: true,
  })
  packageOperationalReadinessReasons!: PackageOperationalReadinessReason[];
}