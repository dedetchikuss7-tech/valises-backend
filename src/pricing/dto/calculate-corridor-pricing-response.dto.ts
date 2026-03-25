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
  pricingCalibrationBasis!: string | null;
  pricingReferenceCorridorCode!: string | null;
  confidenceLevel!: PricingConfidenceLevel;

  isEstimated!: boolean;
  requiresManualReview!: boolean;
  isVisible!: boolean;
  isBookable!: boolean;
  isActive!: boolean;

  pricingWarningCode!: string | null;
  pricingWarningMessage!: string | null;
  pricingBadge!: string | null;

  pricingUiStatus!: string;
  pricingUiTitle!: string;
  pricingUiMessage!: string;

  pricingModelType!: PricingModelTypeDto;
  settlementCurrency!: CurrencyCode;

  senderPrice!: string;
  travelerGain!: string;
  spread!: string;

  weightKg!: number | null;

  notes!: string | null;
}