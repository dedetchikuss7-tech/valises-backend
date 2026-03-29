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
import { ListPricingCorridorsSortByDto } from './dto/list-pricing-corridors-sort-by.enum';

describe('PricingService', () => {
  let service: PricingService;

  const prisma = {
    corridorPricingPaymentConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
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

  it('lists pricing corridors with frontend-friendly summary signals, response metadata, total, and default sorting', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([
      buildPricingConfig(),
      buildPricingConfig({
        id: 'pricing-2',
        corridorCode: 'FR_CI',
        destinationCountryCode: 'CI',
        pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
        confidenceLevel: PricingConfidenceLevel.MEDIUM,
        isEstimated: true,
        requiresManualReview: true,
      }),
    ]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(143);

    const result = await service.listPricingCorridors({
      limit: 100,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 100,
    });

    expect(prisma.corridorPricingPaymentConfig.count).toHaveBeenCalledWith({
      where: {},
    });

    expect(result).toEqual({
      items: [
        {
          corridorCode: 'FR_CM',
          originCountryCode: 'FR',
          destinationCountryCode: 'CM',
          status: CorridorPricingStatus.SOCLE,
          pricingSourceType: PricingSourceType.OBSERVED,
          confidenceLevel: PricingConfidenceLevel.HIGH,
          isEstimated: false,
          requiresManualReview: false,
          isVisible: true,
          isBookable: true,
          isActive: true,
          pricingBadge: 'OBSERVED_HIGH_CONFIDENCE',
          pricingUiStatus: 'READY',
          pricingUiTitle: 'Observed pricing',
          pricingUiMessage:
            'This corridor uses observed pricing with high confidence.',
          settlementCurrency: CurrencyCode.EUR,
        },
        {
          corridorCode: 'FR_CI',
          originCountryCode: 'FR',
          destinationCountryCode: 'CI',
          status: CorridorPricingStatus.SOCLE,
          pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
          confidenceLevel: PricingConfidenceLevel.MEDIUM,
          isEstimated: true,
          requiresManualReview: true,
          isVisible: true,
          isBookable: true,
          isActive: true,
          pricingBadge: 'ESTIMATED_MEDIUM_CONFIDENCE',
          pricingUiStatus: 'ESTIMATED',
          pricingUiTitle: 'Estimated pricing',
          pricingUiMessage:
            'This corridor uses estimated pricing and should be reviewed with caution.',
          settlementCurrency: CurrencyCode.EUR,
        },
      ],
      count: 2,
      limit: 100,
      total: 143,
    });
  });

  it('lists pricing corridors with normalized country filters and boolean filters', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(0);

    const result = await service.listPricingCorridors({
      originCountryCode: 'fr',
      destinationCountryCode: 'cm',
      status: CorridorPricingStatus.SOCLE,
      isVisible: true,
      isBookable: true,
      isActive: true,
      limit: 50,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {
        originCountryCode: 'FR',
        destinationCountryCode: 'CM',
        status: CorridorPricingStatus.SOCLE,
        isVisible: true,
        isBookable: true,
        isActive: true,
      },
      orderBy: [
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 50,
    });

    expect(prisma.corridorPricingPaymentConfig.count).toHaveBeenCalledWith({
      where: {
        originCountryCode: 'FR',
        destinationCountryCode: 'CM',
        status: CorridorPricingStatus.SOCLE,
        isVisible: true,
        isBookable: true,
        isActive: true,
      },
    });

    expect(result).toEqual({
      items: [],
      count: 0,
      limit: 50,
      total: 0,
    });
  });

  it('lists pricing corridors filtered by pricingSourceType', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(0);

    const result = await service.listPricingCorridors({
      pricingSourceType: PricingSourceType.OBSERVED,
      limit: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {
        pricingSourceType: PricingSourceType.OBSERVED,
      },
      orderBy: [
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.count).toHaveBeenCalledWith({
      where: {
        pricingSourceType: PricingSourceType.OBSERVED,
      },
    });

    expect(result).toEqual({
      items: [],
      count: 0,
      limit: 25,
      total: 0,
    });
  });

  it('lists pricing corridors filtered by pricingCalibrationBasis', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(0);

    const result = await service.listPricingCorridors({
      pricingCalibrationBasis: 'TERRAIN_DATA',
      limit: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {
        pricingCalibrationBasis: 'TERRAIN_DATA',
      },
      orderBy: [
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.count).toHaveBeenCalledWith({
      where: {
        pricingCalibrationBasis: 'TERRAIN_DATA',
      },
    });

    expect(result).toEqual({
      items: [],
      count: 0,
      limit: 25,
      total: 0,
    });
  });

  it('lists pricing corridors with combined pricingCalibrationBasis and boolean filters', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(0);

    const result = await service.listPricingCorridors({
      pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
      isEstimated: true,
      requiresManualReview: true,
      isVisible: true,
      isBookable: false,
      isActive: true,
      limit: 10,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {
        pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
        isEstimated: true,
        requiresManualReview: true,
        isVisible: true,
        isBookable: false,
        isActive: true,
      },
      orderBy: [
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 10,
    });

    expect(prisma.corridorPricingPaymentConfig.count).toHaveBeenCalledWith({
      where: {
        pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
        isEstimated: true,
        requiresManualReview: true,
        isVisible: true,
        isBookable: false,
        isActive: true,
      },
    });

    expect(result).toEqual({
      items: [],
      count: 0,
      limit: 10,
      total: 0,
    });
  });

  it('lists pricing corridors with combined pricingSourceType and boolean filters', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(0);

    const result = await service.listPricingCorridors({
      pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
      isEstimated: true,
      requiresManualReview: true,
      isVisible: true,
      isBookable: false,
      isActive: true,
      limit: 10,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {
        pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
        isEstimated: true,
        requiresManualReview: true,
        isVisible: true,
        isBookable: false,
        isActive: true,
      },
      orderBy: [
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 10,
    });

    expect(prisma.corridorPricingPaymentConfig.count).toHaveBeenCalledWith({
      where: {
        pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
        isEstimated: true,
        requiresManualReview: true,
        isVisible: true,
        isBookable: false,
        isActive: true,
      },
    });

    expect(result).toEqual({
      items: [],
      count: 0,
      limit: 10,
      total: 0,
    });
  });

  it('lists pricing corridors filtered by estimated pricing', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(0);

    const result = await service.listPricingCorridors({
      isEstimated: true,
      limit: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {
        isEstimated: true,
      },
      orderBy: [
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.count).toHaveBeenCalledWith({
      where: {
        isEstimated: true,
      },
    });

    expect(result).toEqual({
      items: [],
      count: 0,
      limit: 25,
      total: 0,
    });
  });

  it('lists pricing corridors filtered by requiresManualReview=true', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(0);

    const result = await service.listPricingCorridors({
      requiresManualReview: true,
      limit: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {
        requiresManualReview: true,
      },
      orderBy: [
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.count).toHaveBeenCalledWith({
      where: {
        requiresManualReview: true,
      },
    });

    expect(result).toEqual({
      items: [],
      count: 0,
      limit: 25,
      total: 0,
    });
  });

  it('lists pricing corridors filtered by requiresManualReview=false', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(0);

    const result = await service.listPricingCorridors({
      requiresManualReview: false,
      limit: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {
        requiresManualReview: false,
      },
      orderBy: [
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.count).toHaveBeenCalledWith({
      where: {
        requiresManualReview: false,
      },
    });

    expect(result).toEqual({
      items: [],
      count: 0,
      limit: 25,
      total: 0,
    });
  });

  it('lists pricing corridors with combined boolean filters including requiresManualReview', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(0);

    const result = await service.listPricingCorridors({
      isEstimated: true,
      requiresManualReview: true,
      isVisible: true,
      isBookable: false,
      isActive: true,
      limit: 10,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {
        isEstimated: true,
        requiresManualReview: true,
        isVisible: true,
        isBookable: false,
        isActive: true,
      },
      orderBy: [
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 10,
    });

    expect(prisma.corridorPricingPaymentConfig.count).toHaveBeenCalledWith({
      where: {
        isEstimated: true,
        requiresManualReview: true,
        isVisible: true,
        isBookable: false,
        isActive: true,
      },
    });

    expect(result).toEqual({
      items: [],
      count: 0,
      limit: 10,
      total: 0,
    });
  });

  it('lists pricing corridors with explicit sorting by confidence level descending', async () => {
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.count.mockResolvedValue(0);

    await service.listPricingCorridors({
      sortBy: ListPricingCorridorsSortByDto.CONFIDENCE_LEVEL,
      sortOrder: 'desc',
      limit: 25,
    });

    expect(prisma.corridorPricingPaymentConfig.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [
        { confidenceLevel: 'desc' },
        { originCountryCode: 'asc' },
        { destinationCountryCode: 'asc' },
        { corridorCode: 'asc' },
      ],
      take: 25,
    });
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

      pricingWarningCode: null,
      pricingWarningMessage: null,
      pricingBadge: 'OBSERVED_HIGH_CONFIDENCE',

      pricingUiStatus: 'READY',
      pricingUiTitle: 'Observed pricing',
      pricingUiMessage:
        'This corridor uses observed pricing with high confidence.',

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

      pricingWarningCode: 'ESTIMATED_PRICING',
      pricingWarningMessage: 'This corridor uses estimated pricing.',
      pricingBadge: 'ESTIMATED_MEDIUM_CONFIDENCE',

      pricingUiStatus: 'ESTIMATED',
      pricingUiTitle: 'Estimated pricing',
      pricingUiMessage:
        'This corridor uses estimated pricing and should be reviewed with caution.',

      pricingModelType: PricingModelTypeDto.BUNDLE_23KG,
      settlementCurrency: CurrencyCode.EUR,

      senderPrice: '185',
      travelerGain: '145',
      spread: '40',

      weightKg: 23,
      notes: 'Seeded for pricing service spec',
    });
  });

  it('returns corridor pricing by code with prudent config signals and estimated warning', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
        pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
        pricingReferenceCorridorCode: 'FR_CI',
        confidenceLevel: PricingConfidenceLevel.MEDIUM,
        isEstimated: true,
        requiresManualReview: true,
      }),
    );

    const result = await service.getCorridorPricingByCode('fr_cm');

    expect(prisma.corridorPricingPaymentConfig.findUnique).toHaveBeenCalledWith({
      where: { corridorCode: 'FR_CM' },
    });

    expect(result).toEqual({
      id: 'pricing-1',
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',

      status: CorridorPricingStatus.SOCLE,
      pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
      pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
      pricingReferenceCorridorCode: 'FR_CI',
      confidenceLevel: PricingConfidenceLevel.MEDIUM,

      isEstimated: true,
      requiresManualReview: true,
      isVisible: true,
      isBookable: true,
      isActive: true,

      pricingWarningCode: 'ESTIMATED_PRICING',
      pricingWarningMessage: 'This corridor uses estimated pricing.',
      pricingBadge: 'ESTIMATED_MEDIUM_CONFIDENCE',

      pricingUiStatus: 'ESTIMATED',
      pricingUiTitle: 'Estimated pricing',
      pricingUiMessage:
        'This corridor uses estimated pricing and should be reviewed with caution.',

      settlementCurrency: CurrencyCode.EUR,

      terrainPricePerKg: '10',
      terrainBundle23kg: '160',
      terrainBundle32kg: '210',

      travelerGainPerKg: '9',
      senderPricePerKg: '11.5',
      spreadPerKg: '2.5',

      travelerGainBundle23kg: '145',
      senderPriceBundle23kg: '185',
      spreadBundle23kg: '40',

      travelerGainBundle32kg: '170',
      senderPriceBundle32kg: '210',
      spreadBundle32kg: '40',

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
    });
  });

  it('throws NotFoundException when pricing config does not exist for calculate', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(null);

    await expect(
      service.calculateCorridorPricing('FR_CM', PricingModelTypeDto.BUNDLE_23KG),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when pricing config does not exist for get by code', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(null);

    await expect(
      service.getCorridorPricingByCode('FR_CM'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when pricing config is inactive for calculate', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        isActive: false,
      }),
    );

    await expect(
      service.calculateCorridorPricing('FR_CM', PricingModelTypeDto.BUNDLE_23KG),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when pricing config is inactive for get by code', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        isActive: false,
      }),
    );

    await expect(service.getCorridorPricingByCode('FR_CM')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when pricing config is not visible for calculate', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        isVisible: false,
      }),
    );

    await expect(
      service.calculateCorridorPricing('FR_CM', PricingModelTypeDto.BUNDLE_23KG),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when pricing config is not visible for get by code', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        isVisible: false,
      }),
    );

    await expect(service.getCorridorPricingByCode('FR_CM')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when pricing config is not bookable for calculate', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        isBookable: false,
      }),
    );

    await expect(
      service.calculateCorridorPricing('FR_CM', PricingModelTypeDto.BUNDLE_23KG),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when pricing config is not bookable for get by code', async () => {
    prisma.corridorPricingPaymentConfig.findUnique.mockResolvedValue(
      buildPricingConfig({
        isBookable: false,
      }),
    );

    await expect(service.getCorridorPricingByCode('FR_CM')).rejects.toThrow(
      ForbiddenException,
    );
  });
});