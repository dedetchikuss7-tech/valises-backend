import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AdminTransactionOperationalTimelineEventType {
  TRANSACTION = 'TRANSACTION',
  DISPUTE = 'DISPUTE',
  EVIDENCE = 'EVIDENCE',
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
  AML = 'AML',
  RESTRICTION = 'RESTRICTION',
  OPERATIONAL_CASE = 'OPERATIONAL_CASE',
  ADMIN_ACTION = 'ADMIN_ACTION',
  TIMELINE_EVENT = 'TIMELINE_EVENT',
}

export class AdminTransactionOperationalTimelineEventDto {
  @ApiProperty({
    enum: AdminTransactionOperationalTimelineEventType,
  })
  type!: AdminTransactionOperationalTimelineEventType;

  @ApiProperty()
  eventCode!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiPropertyOptional()
  actorUserId!: string | null;

  @ApiPropertyOptional()
  relatedObjectId!: string | null;

  @ApiPropertyOptional()
  relatedObjectType!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({
    type: Object,
  })
  metadata!: Record<string, unknown> | null;
}