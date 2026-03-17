import { ReminderChannel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsEnum,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReminderJobsFromEventsDto {
  @ApiProperty({
    type: [String],
    example: [
      '459e66d1-121d-429b-82cc-163baf21b052',
      '04c6ef4f-980b-4cf7-9006-2ddba4003420',
    ],
    description: 'Abandonment event IDs to create reminder jobs for',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  eventIds!: string[];

  @ApiProperty({
    enum: ReminderChannel,
    example: ReminderChannel.EMAIL,
    description: 'Reminder delivery channel',
  })
  @IsEnum(ReminderChannel)
  channel!: ReminderChannel;

  @ApiProperty({
    example: '2026-03-18T09:00:00.000Z',
    description: 'When the reminder jobs should be scheduled',
  })
  @Type(() => Date)
  @IsDate()
  scheduledFor!: Date;

  @ApiPropertyOptional({
    example: {
      templateKey: 'abandonment_followup_manual_batch',
      note: 'Created in batch by admin',
    },
    description: 'Optional additional payload/metadata stored on created reminder jobs',
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}