import {
  CorridorPricingStatus,
  CurrencyCode,
  PricingConfidenceLevel,
  PricingSourceType,
} from '@prisma/client';
import { PricingModelTypeDto } from './pricing-model-type.enum';

export class CalculateCorridorPricingResponseDto {
  corridorCode!: string;
  originCountryCode!: string;
  destinationCountryCode!: string;

  status!: CorridorPricingStatus;
  pricingSourceType!: PricingSourceType;
  confidenceLevel!: PricingConfidenceLevel;

  isEstimated!: boolean;
  requiresManualReview!: boolean;

  pricingModelType!: PricingModelTypeDto;
  settlementCurrency!: CurrencyCode;

  senderPrice!: string;
  travelerGain!: string;
  spread!: string;

  weightKg!: number | null;

  notes!: string | null;
}