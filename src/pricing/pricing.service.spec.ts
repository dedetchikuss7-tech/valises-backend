import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CorridorPricingStatus,
  CurrencyCode,
  PaymentMethodType,
  PaymentRailProvider,
  PricingConfidenceLevel,
  PricingSourceType,
  PayoutMethodType,
} from '@prisma/client';
import { PricingService } from './pricing.service';
import { PricingModelTypeDto } from './dto/pricing-model-type.enum';

describe('PricingService', () => {
  let service: PricingService;

  const prisma = {
    corridorPricingPaymentConfig: {
      findUnique: jest.fn(),
    },
  };

  const buildPricingConfig = (overrides?: Partial<any>) => ({
    id: 'pricing-1',
    corridorCode: 'FR_CM',
    originCountryCode: 'FR',
    destinationCountryCode: 'CM',

    status: CorridorPricingStatus.SOCLE,
    pricingSourceType: PricingSourceType.OBSERVED,
    pricingCalibrationBasis: 'TERRAIN_DATA',
    pricingReferenceCorridorCode: null,
    confidenceLevel: PricingConfidenceLevel.HIGH,

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,
    isActive: true,

    settlementCurrency: CurrencyCode.EUR,

    terrainPricePerKg: { toString: () => '10' },
    terrainBundle23kg: { toString: () => '160' },
    terrainBundle32kg: { toString: () => '210' },

    travelerGainPerKg: {
      mul: (n: number) => ({ toString: () => String(9 * n) }),
      toString: () => '9',
    },
    senderPricePerKg: {
      mul: (n: number) => ({ toString: () => String(11.5 * n) }),
      toString: () => '11.5',
    },
    spreadPerKg: {
      mul: (n: number) => ({ toString: () => String(2.5 * n) }),
      toString: () => '2.5',
    },

    travelerGainBundle23kg: { toString: () => '145' },
    senderPriceBundle23kg: { toString: () => '185' },
    spreadBundle23kg: { toString: () => '40' },

    travelerGainBundle32kg: { toString: () => '170' },
    senderPriceBundle32kg: { toString: () => '210' },
    spreadBundle32kg: { toString: () => '40' },

    payinMethodsAllowed: [PaymentMethodType.CARD],
    payoutMethodsAllowed: [PayoutMethodType.MOBILE_MONEY],

    payinPrimaryRail: PaymentRailProvider.STRIPE,
    payinBackupRail: PaymentRailProvider.BANK,
    payoutPrimaryRail: PaymentRailProvider.CINETPAY,
    payoutBackupRail: PaymentRailProvider.MANUAL,
    fallbackRail: PaymentRailProvider.MANUAL,

    notes: 'Seeded for pricing service spec',
    createdAt: new Date('2026-03-25T10:00:00.000Z'),
    updatedAt: new Date('2026-03-25T10:00:00.000Z'),

    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PricingService(prisma as any);
  });

  it('calculates PER_KG pricing and exposes prudent config signals', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig(),
    );

    const result = await service.calculateCorridorPricing(
      'fr_cm',
      PricingModelTypeDto.PER_KG,
      10,
    );

    expect(prisma.corridorPricingPaymentConfig.findUnique).toHaveBeenCalledWith({
      where: { corridorCode: 'FR_CM' },
    });

    expect(result).toEqual({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',

      status: CorridorPricingStatus.SOCLE,
      pricingSourceType: PricingSourceType.OBSERVED,
      pricingCalibrationBasis: 'TERRAIN_DATA',
      pricingReferenceCorridorCode: null,
      confidenceLevel: PricingConfidenceLevel.HIGH,

      isEstimated: false,
      requiresManualReview: false,
      isVisible: true,
      isBookable: true,
      isActive: true,

      pricingModelType: PricingModelTypeDto.PER_KG,
      settlementCurrency: CurrencyCode.EUR,

      senderPrice: '115',
      travelerGain: '90',
      spread: '25',

      weightKg: 10,
      notes: 'Seeded for pricing service spec',
    });
  });

  it('calculates BUNDLE_23KG pricing and exposes prudent config signals', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        pricingSourceType: PricingSourceType.REGIONAL_TEMPLATE,
        pricingCalibrationBasis: 'REGIONAL_TEMPLATE_V1',
        pricingReferenceCorridorCode: 'FR_SN',
        confidenceLevel: PricingConfidenceLevel.MEDIUM,
        isEstimated: true,
        requiresManualReview: true,
      }),
    );

    const result = await service.calculateCorridorPricing(
      'FR_CM',
      PricingModelTypeDto.BUNDLE_23KG,
    );

    expect(result).toEqual({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',

      status: CorridorPricingStatus.SOCLE,
      pricingSourceType: PricingSourceType.REGIONAL_TEMPLATE,
      pricingCalibrationBasis: 'REGIONAL_TEMPLATE_V1',
      pricingReferenceCorridorCode: 'FR_SN',
      confidenceLevel: PricingConfidenceLevel.MEDIUM,

      isEstimated: true,
      requiresManualReview: true,
      isVisible: true,
      isBookable: true,
      isActive: true,

      pricingModelType: PricingModelTypeDto.BUNDLE_23KG,
      settlementCurrency: CurrencyCode.EUR,

      senderPrice: '185',
      travelerGain: '145',
      spread: '40',

      weightKg: 23,
      notes: 'Seeded for pricing service spec',
    });
  });

  it('throws NotFoundException when pricing config does not exist', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(null);

    await expect(
      service.calculateCorridorPricing('FR_CM', PricingModelTypeDto.BUNDLE_23KG),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when pricing config is inactive', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        isActive: false,
      }),
    );

    await expect(
      service.calculateCorridorPricing('FR_CM', PricingModelTypeDto.BUNDLE_23KG),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when pricing config is not visible', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        isVisible: false,
      }),
    );

    await expect(
      service.calculateCorridorPricing('FR_CM', PricingModelTypeDto.BUNDLE_23KG),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when pricing config is not bookable', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        isBookable: false,
      }),
    );

    await expect(
      service.calculateCorridorPricing('FR_CM', PricingModelTypeDto.BUNDLE_23KG),
    ).rejects.toThrow(ForbiddenException);
  });
});