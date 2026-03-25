import {
  CorridorPricingStatus,
  CurrencyCode,
  PaymentRailProvider,
  PricingConfidenceLevel,
  PricingSourceType,
} from '@prisma/client';

export class GetCorridorPricingResponseDto {
  id!: string;
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

  settlementCurrency!: CurrencyCode;

  terrainPricePerKg!: string | null;
  terrainBundle23kg!: string | null;
  terrainBundle32kg!: string | null;

  travelerGainPerKg!: string | null;
  senderPricePerKg!: string | null;
  spreadPerKg!: string | null;

  travelerGainBundle23kg!: string | null;
  senderPriceBundle23kg!: string | null;
  spreadBundle23kg!: string | null;

  travelerGainBundle32kg!: string | null;
  senderPriceBundle32kg!: string | null;
  spreadBundle32kg!: string | null;

  payinMethodsAllowed!: string[];
  payoutMethodsAllowed!: string[];

  payinPrimaryRail!: PaymentRailProvider;
  payinBackupRail!: PaymentRailProvider | null;
  payoutPrimaryRail!: PaymentRailProvider;
  payoutBackupRail!: PaymentRailProvider | null;
  fallbackRail!: PaymentRailProvider;

  notes!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}