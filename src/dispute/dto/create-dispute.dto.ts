import { IsEnum, IsString } from 'class-validator';
import { DisputeReasonCode } from '@prisma/client';

export class CreateDisputeDto {
  @IsString()
  transactionId!: string;

  @IsString()
  reason!: string;

  @IsEnum(DisputeReasonCode)
  reasonCode!: DisputeReasonCode;
}