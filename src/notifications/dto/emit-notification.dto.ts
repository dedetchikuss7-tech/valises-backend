import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  NotificationCategory,
  NotificationSeverity,
} from './list-my-notifications-query.dto';

export class EmitNotificationDto {
  @ApiProperty()
  @IsString()
  recipientUserId!: string;

  @ApiPropertyOptional({
    description: 'Optional recipient role snapshot',
  })
  @IsOptional()
  @IsString()
  recipientRole?: string;

  @ApiProperty({ enum: NotificationCategory })
  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  @ApiProperty({ enum: NotificationSeverity })
  @IsEnum(NotificationSeverity)
  severity!: NotificationSeverity;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contextType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contextId?: string;

  @ApiPropertyOptional({
    description: 'Optional opaque metadata summary string',
  })
  @IsOptional()
  @IsString()
  metadataSummary?: string;
}