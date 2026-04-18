import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReputationEventKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RecordReputationEventDto {
  @ApiProperty({
    enum: ReputationEventKind,
    description: 'Kind of reputation event to record',
  })
  @IsEnum(ReputationEventKind)
  kind!: ReputationEventKind;

  @ApiProperty({
    description:
      'Score delta applied to the user trust profile. Positive increases score, negative decreases score.',
    minimum: -100,
    maximum: 100,
    example: -15,
  })
  @Type(() => Number)
  @IsInt()
  @Min(-100)
  @Max(100)
  scoreDelta!: number;

  @ApiProperty({
    description: 'Machine-readable reason code for this event',
    example: 'DISPUTE_OPENED',
  })
  @IsString()
  @MaxLength(100)
  reasonCode!: string;

  @ApiPropertyOptional({
    description: 'Optional human-readable summary for this event',
    example: 'A dispute was opened against this transaction.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonSummary?: string;

  @ApiPropertyOptional({
    description: 'Optional related transaction id',
  })
  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Optional structured metadata',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}