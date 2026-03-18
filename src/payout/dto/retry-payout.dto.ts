import { ApiPropertyOptional } from '@nestjs/swagger';
import { PayoutProvider } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RetryPayoutDto {
  @ApiPropertyOptional({
    enum: PayoutProvider,
    description: 'Optional provider override for the retry',
    example: PayoutProvider.MANUAL,
  })
  @IsOptional()
  @IsEnum(PayoutProvider)
  provider?: PayoutProvider;

  @ApiPropertyOptional({
    description: 'Optional reason recorded in metadata',
    example: 'Retry after provider timeout',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}