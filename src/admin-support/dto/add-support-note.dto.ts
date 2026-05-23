import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export const SUPPORT_NOTE_TARGET_TYPES = [
  'TRANSACTION',
  'USER',
  'PAYOUT',
  'DISPUTE',
] as const;

export type SupportNoteTargetType = (typeof SUPPORT_NOTE_TARGET_TYPES)[number];

export class AddSupportNoteDto {
  @ApiProperty({ enum: SUPPORT_NOTE_TARGET_TYPES })
  @IsIn(SUPPORT_NOTE_TARGET_TYPES)
  targetType!: SupportNoteTargetType;

  @ApiProperty({ description: 'UUID of the target entity' })
  @IsUUID()
  targetId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;
}
