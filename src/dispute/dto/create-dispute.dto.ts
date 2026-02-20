// src/dispute/dto/create-dispute.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  transactionId!: string;

  @IsString()
  raisedById!: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}