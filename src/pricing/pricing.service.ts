import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CorridorPricingPaymentConfig,
  PricingConfidenceLevel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetCorridorPricingResponseDto } from './dto/get-corridor-pricing-response.dto';
import { CalculateCorridorPricingResponseDto } from './dto/calculate-corridor-pricing-response.dto';
import { PricingModelTypeDto } from './dto/pricing-model-type.enum';
import { ListPricingCorridorsQueryDto } from './dto/list-pricing-corridors-query.dto';
import { ListPricingCorridorsResponseDto } from './dto/list-pricing-corridors-response.dto';
import { ListPricingCorridorsResultDto } from './dto/list-pricing-corridors-result.dto';
import { ListPricingCorridorsSortByDto } from './dto/list-pricing-corridors-sort-by.enum';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async listPricingCorridors(
    query: ListPricingCorridorsQueryDto,
  ): Promise<ListPricingCorridorsResultDto> {
    const where: Prisma.CorridorPricingPaymentConfigWhereInput = {};

    if (query.originCountryCode) {
      where.originCountryCode = query.originCountryCode.trim().toUpperCase();
    }

    if (query.destinationCountryCode) {
      where.destinationCountryCode =
        query.destinationCountryCode.trim().toUpperCase();
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.confidenceLevel) {
      where.confidenceLevel = query.confidenceLevel;
    }

    if (query.pricingSourceType) {
      where.pricingSourceType = query.pricingSourceType;
    }

    if (query.pricingCalibrationBasis) {
      where.pricingCalibrationBasis = query.pricingCalibrationBasis.trim();
    }

    if (query.pricingReferenceCorridorCode) {
      where.pricingReferenceCorridorCode =
        query.pricingReferenceCorridorCode.trim().toUpperCase();
    }

    const normalizedIsEstimated = this.normalizeOptionalBoolean(
      query.isEstimated,
    );
    const normalizedRequiresManualReview = this.normalizeOptionalBoolean(
      query.requiresManualReview,
    );
    const normalizedIsVisible = this.normalizeOptionalBoolean(query.isVisible);
    const normalizedIsBookable = this.normalizeOptionalBoolean(query.isBookable);
    const normalizedIsActive = this.normalizeOptionalBoolean(query.isActive);
    const normalizedLimit = this.normalizeLimit(query.limit);
    const orderBy = this.buildOrderBy(query);

    if (normalizedIsEstimated !== undefined) {
      where.isEstimated = normalizedIsEstimated;
    }

    if (normalizedRequiresManualReview !== undefined) {
      where.requiresManualReview = normalizedRequiresManualReview;
    }

    if (normalizedIsVisible !== undefined) {
      where.isVisible = normalizedIsVisible;
    }

    if (normalizedIsBookable !== undefined) {
      where.isBookable = normalizedIsBookable;
    }

    if (normalizedIsActive !== undefined) {
      where.isActive = normalizedIsActive;
    }

    const [pricingConfigs, total] = await Promise.all([
      this.prisma.corridorPricingPaymentConfig.findMany({
        where,
        orderBy,
        take: normalizedLimit,
      }),
      this.prisma.corridorPricingPaymentConfig.count({
        where,
      }),
    ]);

    const items = pricingConfigs.map((pricing) =>
      this.toListResponseDto(pricing),
    );

    return {
      items,
      count: items.length,
      limit: normalizedLimit,
      total,
    };
  }

  async getCorridorPricingByCode(
    corridorCode: string,
  ): Promise<GetCorridorPricingResponseDto> {
    const pricing = await this.getUsablePricingOrThrow(corridorCode);
    return this.toResponseDto(pricing);
  }

  async calculateCorridorPricing(
    corridorCode: string,
    pricingModelType: PricingModelTypeDto,
    weightKg?: number,
  ): Promise<CalculateCorridorPricingResponseDto> {
    const pricing = await this.getUsablePricingOrThrow(corridorCode);

    switch (pricingModelType) {
      case PricingModelTypeDto.PER_KG:
        return this.calculatePerKg(pricing, weightKg);

      case PricingModelTypeDto.BUNDLE_23KG:
        return this.calculateBundle23kg(pricing);

      case PricingModelTypeDto.BUNDLE_32KG:
        return this.calculateBundle32kg(pricing);

      default:
        throw new ForbiddenException(
          `Unsupported pricing model type ${pricingModelType}`,
        );
    }
  }

  private buildOrderBy(
    query: ListPricingCorridorsQueryDto,
  ): Prisma.CorridorPricingPaymentConfigOrderByWithRelationInput[] {
    const sortBy =
      query.sortBy ?? ListPricingCorridorsSortByDto.ORIGIN_COUNTRY_CODE;
    const sortOrder = query.sortOrder ?? 'asc';

    switch (sortBy) {
      case ListPricingCorridorsSortByDto.CORRIDOR_CODE:
        return [
          { corridorCode: sortOrder },
          { originCountryCode: 'asc' },
          { destinationCountryCode: 'asc' },
        ];

      case ListPricingCorridorsSortByDto.DESTINATION_COUNTRY_CODE:
        return [
          { destinationCountryCode: sortOrder },
          { originCountryCode: 'asc' },
          { corridorCode: 'asc' },
        ];

      case ListPricingCorridorsSortByDto.STATUS:
        return [
          { status: sortOrder },
          { originCountryCode: 'asc' },
          { destinationCountryCode: 'asc' },
          { corridorCode: 'asc' },
        ];

      case ListPricingCorridorsSortByDto.CONFIDENCE_LEVEL:
        return [
          { confidenceLevel: sortOrder },
          { originCountryCode: 'asc' },
          { destinationCountryCode: 'asc' },
          { corridorCode: 'asc' },
        ];

      case ListPricingCorridorsSortByDto.ORIGIN_COUNTRY_CODE:
      default:
        return [
          { originCountryCode: sortOrder },
          { destinationCountryCode: 'asc' },
          { corridorCode: 'asc' },
        ];
    }
  }

  private normalizeOptionalBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();

      if (normalized === 'true') {
        return true;
      }

      if (normalized === 'false') {
        return false;
      }
    }

    return undefined;
  }

  private normalizeLimit(value: unknown): number {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);

      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return 100;
  }

  private async getUsablePricingOrThrow(
    corridorCode: string,
  ): Promise<CorridorPricingPaymentConfig> {
    const normalizedCode = corridorCode.trim().toUpperCase();

    const pricing = await this.prisma.corridorPricingPaymentConfig.findUnique({
      where: { corridorCode: normalizedCode },
    });

    if (!pricing) {
      throw new NotFoundException(
        `Pricing configuration not found for corridor ${normalizedCode}`,
      );
    }

    this.assertCorridorPricingIsUsable(pricing);

    return pricing;
  }

  private assertCorridorPricingIsUsable(
    pricing: CorridorPricingPaymentConfig,
  ): void {
    if (!pricing.isActive) {
      throw new ForbiddenException(
        `Pricing configuration for corridor ${pricing.corridorCode} is inactive`,
      );
    }

    if (!pricing.isVisible) {
      throw new ForbiddenException(
        `Pricing configuration for corridor ${pricing.corridorCode} is not visible`,
      );
    }

    if (!pricing.isBookable) {
      throw new ForbiddenException(
        `Pricing configuration for corridor ${pricing.corridorCode} is not bookable`,
      );
    }
  }

  private buildPricingWarning(
    pricing: CorridorPricingPaymentConfig,
  ): {
    pricingWarningCode: string | null;
    pricingWarningMessage: string | null;
  } {
    if (pricing.isEstimated) {
      return {
        pricingWarningCode: 'ESTIMATED_PRICING',
        pricingWarningMessage: 'This corridor uses estimated pricing.',
      };
    }

    return {
      pricingWarningCode: null,
      pricingWarningMessage: null,
    };
  }

  private buildPricingBadge(
    pricing: CorridorPricingPaymentConfig,
  ): string | null {
    const prefix = pricing.isEstimated ? 'ESTIMATED' : 'OBSERVED';

    switch (pricing.confidenceLevel) {
      case PricingConfidenceLevel.HIGH:
        return `${prefix}_HIGH_CONFIDENCE`;
      case PricingConfidenceLevel.MEDIUM:
        return `${prefix}_MEDIUM_CONFIDENCE`;
      case PricingConfidenceLevel.LOW:
        return `${prefix}_LOW_CONFIDENCE`;
      default:
        return null;
    }
  }

  private buildPricingUiSignals(
    pricing: CorridorPricingPaymentConfig,
  ): {
    pricingUiStatus: string;
    pricingUiTitle: string;
    pricingUiMessage: string;
  } {
    if (pricing.isEstimated) {
      switch (pricing.confidenceLevel) {
        case PricingConfidenceLevel.HIGH:
          return {
            pricingUiStatus: 'ESTIMATED',
            pricingUiTitle: 'Estimated pricing',
            pricingUiMessage:
              'This corridor uses estimated pricing with relatively good confidence.',
          };

        case PricingConfidenceLevel.MEDIUM:
          return {
            pricingUiStatus: 'ESTIMATED',
            pricingUiTitle: 'Estimated pricing',
            pricingUiMessage:
              'This corridor uses estimated pricing and should be reviewed with caution.',
          };

        case PricingConfidenceLevel.LOW:
        default:
          return {
            pricingUiStatus: 'ESTIMATED_CAUTION',
            pricingUiTitle: 'Estimated pricing',
            pricingUiMessage:
              'This corridor uses low-confidence estimated pricing and requires extra caution.',
          };
      }
    }

    switch (pricing.confidenceLevel) {
      case PricingConfidenceLevel.HIGH:
        return {
          pricingUiStatus: 'READY',
          pricingUiTitle: 'Observed pricing',
          pricingUiMessage:
            'This corridor uses observed pricing with high confidence.',
        };

      case PricingConfidenceLevel.MEDIUM:
        return {
          pricingUiStatus: 'READY',
          pricingUiTitle: 'Observed pricing',
          pricingUiMessage:
            'This corridor uses observed pricing with medium confidence.',
        };

      case PricingConfidenceLevel.LOW:
      default:
        return {
          pricingUiStatus: 'READY_WITH_CAUTION',
          pricingUiTitle: 'Observed pricing',
          pricingUiMessage:
            'This corridor uses observed pricing, but confidence is limited.',
        };
    }
  }

  private toListResponseDto(
    pricing: CorridorPricingPaymentConfig,
  ): ListPricingCorridorsResponseDto {
    const pricingBadge = this.buildPricingBadge(pricing);
    const pricingUiSignals = this.buildPricingUiSignals(pricing);

    return {
      corridorCode: pricing.corridorCode,
      originCountryCode: pricing.originCountryCode,
      destinationCountryCode: pricing.destinationCountryCode,
      status: pricing.status,
      pricingSourceType: pricing.pricingSourceType,
      confidenceLevel: pricing.confidenceLevel,
      isEstimated: pricing.isEstimated,
      requiresManualReview: pricing.requiresManualReview,
      isVisible: pricing.isVisible,
      isBookable: pricing.isBookable,
      isActive: pricing.isActive,
      pricingBadge,
      pricingUiStatus: pricingUiSignals.pricingUiStatus,
      pricingUiTitle: pricingUiSignals.pricingUiTitle,
      pricingUiMessage: pricingUiSignals.pricingUiMessage,
      settlementCurrency: pricing.settlementCurrency,
    };
  }

  private baseCalculatedResponse(
    pricing: CorridorPricingPaymentConfig,
  ): Pick<
    CalculateCorridorPricingResponseDto,
    | 'corridorCode'
    | 'originCountryCode'
    | 'destinationCountryCode'
    | 'status'
    | 'pricingSourceType'
    | 'pricingCalibrationBasis'
    | 'pricingReferenceCorridorCode'
    | 'confidenceLevel'
    | 'isEstimated'
    | 'requiresManualReview'
    | 'isVisible'
    | 'isBookable'
    | 'isActive'
    | 'pricingWarningCode'
    | 'pricingWarningMessage'
    | 'pricingBadge'
    | 'pricingUiStatus'
    | 'pricingUiTitle'
    | 'pricingUiMessage'
    | 'settlementCurrency'
    | 'notes'
  > {
    const warning = this.buildPricingWarning(pricing);
    const pricingBadge = this.buildPricingBadge(pricing);
    const pricingUiSignals = this.buildPricingUiSignals(pricing);

    return {
      corridorCode: pricing.corridorCode,
      originCountryCode: pricing.originCountryCode,
      destinationCountryCode: pricing.destinationCountryCode,

      status: pricing.status,
      pricingSourceType: pricing.pricingSourceType,
      pricingCalibrationBasis: pricing.pricingCalibrationBasis,
      pricingReferenceCorridorCode: pricing.pricingReferenceCorridorCode,
      confidenceLevel: pricing.confidenceLevel,

      isEstimated: pricing.isEstimated,
      requiresManualReview: pricing.requiresManualReview,
      isVisible: pricing.isVisible,
      isBookable: pricing.isBookable,
      isActive: pricing.isActive,

      pricingWarningCode: warning.pricingWarningCode,
      pricingWarningMessage: warning.pricingWarningMessage,
      pricingBadge,

      pricingUiStatus: pricingUiSignals.pricingUiStatus,
      pricingUiTitle: pricingUiSignals.pricingUiTitle,
      pricingUiMessage: pricingUiSignals.pricingUiMessage,

      settlementCurrency: pricing.settlementCurrency,
      notes: pricing.notes,
    };
  }

  private calculatePerKg(
    pricing: CorridorPricingPaymentConfig,
    weightKg?: number,
  ): CalculateCorridorPricingResponseDto {
    if (
      !pricing.senderPricePerKg ||
      !pricing.travelerGainPerKg ||
      !pricing.spreadPerKg
    ) {
      throw new ForbiddenException(
        `PER_KG pricing is not configured for corridor ${pricing.corridorCode}`,
      );
    }

    if (weightKg === undefined || weightKg === null || Number.isNaN(weightKg)) {
      throw new ForbiddenException(
        `weightKg is required for PER_KG pricing on corridor ${pricing.corridorCode}`,
      );
    }

    if (weightKg <= 0) {
      throw new ForbiddenException(`weightKg must be greater than 0`);
    }

    const senderPrice = pricing.senderPricePerKg.mul(weightKg);
    const travelerGain = pricing.travelerGainPerKg.mul(weightKg);
    const spread = pricing.spreadPerKg.mul(weightKg);

    return {
      ...this.baseCalculatedResponse(pricing),
      pricingModelType: PricingModelTypeDto.PER_KG,
      senderPrice: senderPrice.toString(),
      travelerGain: travelerGain.toString(),
      spread: spread.toString(),
      weightKg,
    };
  }

  private calculateBundle23kg(
    pricing: CorridorPricingPaymentConfig,
  ): CalculateCorridorPricingResponseDto {
    if (
      !pricing.senderPriceBundle23kg ||
      !pricing.travelerGainBundle23kg ||
      !pricing.spreadBundle23kg
    ) {
      throw new ForbiddenException(
        `BUNDLE_23KG pricing is not configured for corridor ${pricing.corridorCode}`,
      );
    }

    return {
      ...this.baseCalculatedResponse(pricing),
      pricingModelType: PricingModelTypeDto.BUNDLE_23KG,
      senderPrice: pricing.senderPriceBundle23kg.toString(),
      travelerGain: pricing.travelerGainBundle23kg.toString(),
      spread: pricing.spreadBundle23kg.toString(),
      weightKg: 23,
    };
  }

  private calculateBundle32kg(
    pricing: CorridorPricingPaymentConfig,
  ): CalculateCorridorPricingResponseDto {
    if (
      !pricing.senderPriceBundle32kg ||
      !pricing.travelerGainBundle32kg ||
      !pricing.spreadBundle32kg
    ) {
      throw new ForbiddenException(
        `BUNDLE_32KG pricing is not configured for corridor ${pricing.corridorCode}`,
      );
    }

    return {
      ...this.baseCalculatedResponse(pricing),
      pricingModelType: PricingModelTypeDto.BUNDLE_32KG,
      senderPrice: pricing.senderPriceBundle32kg.toString(),
      travelerGain: pricing.travelerGainBundle32kg.toString(),
      spread: pricing.spreadBundle32kg.toString(),
      weightKg: 32,
    };
  }

  private toResponseDto(
    pricing: CorridorPricingPaymentConfig,
  ): GetCorridorPricingResponseDto {
    const warning = this.buildPricingWarning(pricing);
    const pricingBadge = this.buildPricingBadge(pricing);
    const pricingUiSignals = this.buildPricingUiSignals(pricing);

    return {
      id: pricing.id,
      corridorCode: pricing.corridorCode,
      originCountryCode: pricing.originCountryCode,
      destinationCountryCode: pricing.destinationCountryCode,

      status: pricing.status,
      pricingSourceType: pricing.pricingSourceType,
      pricingCalibrationBasis: pricing.pricingCalibrationBasis,
      pricingReferenceCorridorCode: pricing.pricingReferenceCorridorCode,
      confidenceLevel: pricing.confidenceLevel,

      isEstimated: pricing.isEstimated,
      requiresManualReview: pricing.requiresManualReview,
      isVisible: pricing.isVisible,
      isBookable: pricing.isBookable,
      isActive: pricing.isActive,

      pricingWarningCode: warning.pricingWarningCode,
      pricingWarningMessage: warning.pricingWarningMessage,
      pricingBadge,

      pricingUiStatus: pricingUiSignals.pricingUiStatus,
      pricingUiTitle: pricingUiSignals.pricingUiTitle,
      pricingUiMessage: pricingUiSignals.pricingUiMessage,

      settlementCurrency: pricing.settlementCurrency,

      terrainPricePerKg: pricing.terrainPricePerKg?.toString() ?? null,
      terrainBundle23kg: pricing.terrainBundle23kg?.toString() ?? null,
      terrainBundle32kg: pricing.terrainBundle32kg?.toString() ?? null,

      travelerGainPerKg: pricing.travelerGainPerKg?.toString() ?? null,
      senderPricePerKg: pricing.senderPricePerKg?.toString() ?? null,
      spreadPerKg: pricing.spreadPerKg?.toString() ?? null,

      travelerGainBundle23kg:
        pricing.travelerGainBundle23kg?.toString() ?? null,
      senderPriceBundle23kg: pricing.senderPriceBundle23kg?.toString() ?? null,
      spreadBundle23kg: pricing.spreadBundle23kg?.toString() ?? null,

      travelerGainBundle32kg:
        pricing.travelerGainBundle32kg?.toString() ?? null,
      senderPriceBundle32kg: pricing.senderPriceBundle32kg?.toString() ?? null,
      spreadBundle32kg: pricing.spreadBundle32kg?.toString() ?? null,

      payinMethodsAllowed: Array.isArray(pricing.payinMethodsAllowed)
        ? (pricing.payinMethodsAllowed as string[])
        : [],
      payoutMethodsAllowed: Array.isArray(pricing.payoutMethodsAllowed)
        ? (pricing.payoutMethodsAllowed as string[])
        : [],

      payinPrimaryRail: pricing.payinPrimaryRail,
      payinBackupRail: pricing.payinBackupRail,
      payoutPrimaryRail: pricing.payoutPrimaryRail,
      payoutBackupRail: pricing.payoutBackupRail,
      fallbackRail: pricing.fallbackRail,

      notes: pricing.notes,
      createdAt: pricing.createdAt,
      updatedAt: pricing.updatedAt,
    };
  }
}