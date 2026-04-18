import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ImposeBehaviorRestrictionDto {
  @ApiProperty({
    enum: BehaviorRestrictionKind,
    description: 'Restriction kind to impose',
  })
  @IsEnum(BehaviorRestrictionKind)
  kind!: BehaviorRestrictionKind;

  @ApiPropertyOptional({
    enum: BehaviorRestrictionScope,
    default: BehaviorRestrictionScope.GLOBAL,
    description: 'Scope of the restriction',
  })
  @IsOptional()
  @IsEnum(BehaviorRestrictionScope)
  scope?: BehaviorRestrictionScope;

  @ApiProperty({
    description: 'Machine-readable reason code',
    example: 'AML_BLOCK',
  })
  @IsString()
  @MaxLength(100)
  reasonCode!: string;

  @ApiPropertyOptional({
    description: 'Optional human-readable explanation',
    example: 'User has been blocked due to AML review outcome.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonSummary?: string;

  @ApiPropertyOptional({
    description: 'Optional expiry timestamp',
    example: '2026-04-30T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Optional structured metadata',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}