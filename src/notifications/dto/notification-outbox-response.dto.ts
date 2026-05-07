import { ApiProperty } from '@nestjs/swagger';
import { NOTIFICATION_CHANNELS } from './emit-notification.dto';
import { NOTIFICATION_STATUSES } from './list-my-notifications-query.dto';

import type { NotificationChannel } from './emit-notification.dto';
import type { NotificationStatus } from './list-my-notifications-query.dto';

export class NotificationOutboxResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    enum: NOTIFICATION_CHANNELS,
  })
  channel!: NotificationChannel;

  @ApiProperty({
    enum: NOTIFICATION_STATUSES,
  })
  status!: NotificationStatus;

  @ApiProperty({ nullable: true })
  recipientUserId!: string | null;

  @ApiProperty()
  templateKey!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty({ nullable: true })
  targetType!: string | null;

  @ApiProperty({ nullable: true })
  targetId!: string | null;

  @ApiProperty({
    additionalProperties: true,
  })
  payload!: Record<string, unknown>;

  @ApiProperty({
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  scheduledFor!: Date;

  @ApiProperty({ nullable: true })
  sentAt!: Date | null;

  @ApiProperty({ nullable: true })
  failedAt!: Date | null;

  @ApiProperty({ nullable: true })
  cancelledAt!: Date | null;

  @ApiProperty({ nullable: true })
  failureReason!: string | null;

  @ApiProperty()
  attemptCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}