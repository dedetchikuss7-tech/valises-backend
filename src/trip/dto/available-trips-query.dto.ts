import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AvailableTripsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by corridor code (e.g. CMR-FR)' })
  @IsOptional()
  @IsString()
  corridorCode?: string;

  @ApiPropertyOptional({ description: 'Start of date window (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End of date window (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
