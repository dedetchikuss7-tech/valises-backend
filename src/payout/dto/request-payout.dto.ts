import { PayoutProvider } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class RequestPayoutDto {
  @IsOptional()
  @IsEnum(PayoutProvider)
  provider?: PayoutProvider;
}