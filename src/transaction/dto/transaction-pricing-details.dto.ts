import { ApiProperty } from '@nestjs/swagger';
import { PricingModelTypeDto } from '../../pricing/dto/pricing-model-type.enum';

export class TransactionPricingDetailsDto {
  @ApiProperty({
    description: 'Corridor code used for pricing',
    example: 'FR_CM',
  })
  corridorCode!: string;

  @ApiProperty({
    description: 'Package weight in kilograms',
    example: 23,
  })
  weightKg!: number;

  @ApiProperty({
    description: 'Pricing model applied to compute the transaction amount',
    enum: PricingModelTypeDto,
    example: PricingModelTypeDto.BUNDLE_23KG,
  })
  pricingModelApplied!: PricingModelTypeDto;

  @ApiProperty({
    description: 'Computed transaction amount',
    example: 185,
  })
  computedAmount!: number;

  @ApiProperty({
    description: 'Settlement currency used for the transaction',
    example: 'EUR',
  })
  settlementCurrency!: string;

  @ApiProperty({
    description: 'Sender price per kg when configured',
    example: 11.5,
    nullable: true,
  })
  senderPricePerKg!: number | null;

  @ApiProperty({
    description: 'Sender price for 23kg bundle when configured',
    example: 185,
    nullable: true,
  })
  senderPriceBundle23kg!: number | null;

  @ApiProperty({
    description: 'Sender price for 32kg bundle when configured',
    example: 210,
    nullable: true,
  })
  senderPriceBundle32kg!: number | null;
}