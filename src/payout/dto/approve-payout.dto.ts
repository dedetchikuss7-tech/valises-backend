import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApprovePayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
