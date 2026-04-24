import { ApiProperty } from '@nestjs/swagger';
import {
  AdminTimelineObjectType,
  AdminTimelineSeverity,
} from '@prisma/client';

export class AdminTimelineEventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AdminTimelineObjectType })
  objectType!: AdminTimelineObjectType;

  @ApiProperty()
  objectId!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  message!: string | null;

  @ApiProperty({ nullable: true })
  actorUserId!: string | null;

  @ApiProperty({ enum: AdminTimelineSeverity })
  severity!: AdminTimelineSeverity;

  @ApiProperty({ nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;
}