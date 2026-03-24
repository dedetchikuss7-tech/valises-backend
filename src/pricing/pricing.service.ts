import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CorridorPricingPaymentConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetCorridorPricingResponseDto } from './dto/get-corridor-pricing-response.dto';
import { CalculateCorridorPricingResponseDto } from './dto/calculate-corridor-pricing-response.dto';
import { PricingModelTypeDto } from './dto/pricing-model-type.enum';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

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
    | 'settlementCurrency'
    | 'notes'
  > {
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