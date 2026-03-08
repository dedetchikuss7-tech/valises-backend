import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePackageDto {
  @IsUUID()
  corridorId: string;

  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @IsOptional()
  @IsString()
  description?: string;
}