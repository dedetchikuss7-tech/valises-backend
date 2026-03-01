import { IsOptional, IsString } from 'class-validator';

export class UpdateKycStatusDto {
  // Accepts numbers as strings too (ex: "2")
  @IsOptional()
  @IsString()
  kycLevel?: string;

  // Accepts "PENDING", "APPROVED", "REJECTED", etc.
  @IsOptional()
  @IsString()
  kycStatus?: string;
}