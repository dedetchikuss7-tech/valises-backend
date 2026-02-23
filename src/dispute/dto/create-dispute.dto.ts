import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DisputeReasonCode } from '@prisma/client';

export class CreateDisputeDto {
  @IsString()
  transactionId!: string;

  @IsString()
  openedById!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsEnum(DisputeReasonCode)
  reasonCode?: DisputeReasonCode;
}