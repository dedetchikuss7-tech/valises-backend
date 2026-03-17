import { ReminderChannel } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReminderJobFromEventDto {
  @ApiProperty({
    enum: ReminderChannel,
    example: ReminderChannel.EMAIL,
    description: 'Reminder delivery channel',
  })
  @IsEnum(ReminderChannel)
  channel!: ReminderChannel;

  @ApiProperty({
    example: '2026-03-18T09:00:00.000Z',
    description: 'When the reminder job should be scheduled',
  })
  @Type(() => Date)
  @IsDate()
  scheduledFor!: Date;

  @ApiPropertyOptional({
    example: {
      templateKey: 'abandonment_followup_manual',
      note: 'Created manually by admin after support review',
    },
    description: 'Optional additional payload/metadata stored on the reminder job',
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}