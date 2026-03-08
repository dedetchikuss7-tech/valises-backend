import { IsISO8601, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class CreateTripDto {
  @IsUUID()
  corridorId: string;

  @IsISO8601()
  departAt: string;

  @IsOptional()
  @IsNumber()
  capacityKg?: number;
}