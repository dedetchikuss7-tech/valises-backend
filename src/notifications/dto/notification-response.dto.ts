import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationCategory,
  NotificationSeverity,
} from './list-my-notifications-query.dto';

export class NotificationResponseDto {
  @ApiProperty()
  notificationId!: string;

  @ApiProperty({ enum: NotificationCategory })
  category!: NotificationCategory;

  @ApiProperty({ enum: NotificationSeverity })
  severity!: NotificationSeverity;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  recipientUserId!: string;

  @ApiProperty({ nullable: true })
  recipientRole!: string | null;

  @ApiProperty({ nullable: true })
  contextType!: string | null;

  @ApiProperty({ nullable: true })
  contextId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  acknowledgedAt!: Date | null;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty({
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;
}