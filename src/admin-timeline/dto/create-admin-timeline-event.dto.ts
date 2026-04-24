import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdminTimelineObjectType,
  AdminTimelineSeverity,
} from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAdminTimelineEventDto {
  @ApiProperty({ enum: AdminTimelineObjectType })
  @IsEnum(AdminTimelineObjectType)
  objectType!: AdminTimelineObjectType;

  @ApiProperty()
  @IsString()
  objectId!: string;

  @ApiProperty({
    description: 'Machine-readable event type',
    example: 'ADMIN_NOTE_ADDED',
  })
  @IsString()
  eventType!: string;

  @ApiProperty({
    description: 'Human-readable event title',
    example: 'Admin note added',
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    description: 'Optional human-readable event message',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    enum: AdminTimelineSeverity,
    default: AdminTimelineSeverity.INFO,
  })
  @IsOptional()
  @IsEnum(AdminTimelineSeverity)
  severity?: AdminTimelineSeverity;

  @ApiPropertyOptional({
    description: 'Optional structured metadata',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}