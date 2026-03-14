import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkRefundedDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}