import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertPackageTripShortlistDto {
  @ApiPropertyOptional({
    description: 'Sender priority rank. Lower means more important.',
    default: 100,
    minimum: 1,
    maximum: 999,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  priorityRank?: number = 100;

  @ApiPropertyOptional({
    description: 'Optional sender note about why this candidate is shortlisted',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Whether this shortlist entry is currently visible/active',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isVisible?: boolean = true;
}