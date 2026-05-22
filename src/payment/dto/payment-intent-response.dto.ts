import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentIntentResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  transactionId: string;

  @ApiProperty({ description: 'URL to redirect the user to complete payment' })
  checkoutUrl: string;

  @ApiProperty({ description: 'Opaque identifier returned by the payment provider' })
  paymentIntentId: string;

  @ApiProperty({ description: 'Provider used to create this intent', example: 'CINETPAY' })
  provider: string;

  @ApiPropertyOptional({ description: 'When the checkout link expires, if known' })
  expiresAt?: Date | null;
}
