import { ApiPropertyOptional } from '@nestjs/swagger';
import { RefundProvider } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RetryRefundDto {
  @ApiPropertyOptional({
    enum: RefundProvider,
    description: 'Optional provider override for the retry',
    example: RefundProvider.MANUAL,
  })
  @IsOptional()
  @IsEnum(RefundProvider)
  provider?: RefundProvider;

  @ApiPropertyOptional({
    description: 'Optional reason recorded in metadata',
    example: 'Retry after provider timeout',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}