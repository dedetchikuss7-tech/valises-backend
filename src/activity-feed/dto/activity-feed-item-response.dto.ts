import { ApiProperty } from '@nestjs/swagger';
import {
  ActivityFeedSeverity,
  ActivityFeedSourceType,
} from './list-activity-feed-query.dto';

export class ActivityFeedItemResponseDto {
  @ApiProperty()
  eventId!: string;

  @ApiProperty({ enum: ActivityFeedSourceType })
  sourceType!: ActivityFeedSourceType;

  @ApiProperty()
  sourceAction!: string;

  @ApiProperty({ enum: ActivityFeedSeverity })
  severity!: ActivityFeedSeverity;

  @ApiProperty()
  occurredAt!: Date;

  @ApiProperty({ nullable: true })
  actorUserId!: string | null;

  @ApiProperty({ nullable: true })
  subjectUserId!: string | null;

  @ApiProperty({ nullable: true })
  secondaryUserId!: string | null;

  @ApiProperty({ nullable: true })
  transactionId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  message!: string | null;

  @ApiProperty({
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;
}