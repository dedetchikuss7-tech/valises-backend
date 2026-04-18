import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReleaseBehaviorRestrictionDto {
  @ApiPropertyOptional({
    description: 'Optional release note',
    example: 'Restriction released after manual review.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}