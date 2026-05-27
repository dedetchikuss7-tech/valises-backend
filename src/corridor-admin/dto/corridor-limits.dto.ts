import { IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateCorridorLimitsDto {
  @ApiPropertyOptional({ description: 'Max weight in kg. null = no limit.' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Type(() => Number)
  maxWeightKg?: number | null;

  @ApiPropertyOptional({ description: 'Max volume in liters. null = no limit.' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Type(() => Number)
  maxVolumeL?: number | null;

  @ApiProperty({
    description: 'If true, exceed = 400. If false (default), exceed = warning only.',
    default: false,
  })
  @IsBoolean()
  @Type(() => Boolean)
  strictLimits: boolean = false;
}
