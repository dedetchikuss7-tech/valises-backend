import { IsISO8601, IsOptional, IsUUID, IsNumber, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTripDto {
  @IsUUID()
  corridorId: string;

  @IsISO8601()
  departAt: string;

  @IsOptional()
  @IsNumber()
  capacityKg?: number;

  @ApiPropertyOptional({ description: 'Departure date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @ApiPropertyOptional({ description: 'Arrival date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;
}
