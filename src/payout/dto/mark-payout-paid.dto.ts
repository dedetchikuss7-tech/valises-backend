import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkPayoutPaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}