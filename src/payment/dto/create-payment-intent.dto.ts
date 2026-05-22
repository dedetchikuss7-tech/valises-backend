import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiPropertyOptional({
    description: 'Custom payment description shown on the checkout page',
    example: 'Envoi de valise Paris → Douala',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'URL to redirect the user after payment',
    example: 'https://app.valises.com/payment/return',
  })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;
}
