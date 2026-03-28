import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PricingService } from './pricing.service';
import { GetCorridorPricingResponseDto } from './dto/get-corridor-pricing-response.dto';
import { CalculateCorridorPricingResponseDto } from './dto/calculate-corridor-pricing-response.dto';
import { PricingModelTypeDto } from './dto/pricing-model-type.enum';
import { ListPricingCorridorsQueryDto } from './dto/list-pricing-corridors-query.dto';
import { ListPricingCorridorsResponseDto } from './dto/list-pricing-corridors-response.dto';

@ApiTags('Pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('corridors')
  @ApiOkResponse({
    description: 'List pricing corridors with frontend-friendly summary signals',
    type: ListPricingCorridorsResponseDto,
    isArray: true,
  })
  async listPricingCorridors(
    @Query() query: ListPricingCorridorsQueryDto,
  ): Promise<ListPricingCorridorsResponseDto[]> {
    return this.pricingService.listPricingCorridors(query);
  }

  @Get('corridors/:corridorCode')
  @ApiParam({
    name: 'corridorCode',
    description: 'Corridor code, for example FR_CM',
    example: 'FR_CM',
  })
  @ApiOkResponse({
    description: 'Canonical pricing configuration for a corridor',
    type: GetCorridorPricingResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Pricing configuration not found',
  })
  @ApiForbiddenResponse({
    description:
      'Pricing configuration exists but is inactive, not visible, or not bookable',
  })
  async getCorridorPricing(
    @Param('corridorCode') corridorCode: string,
  ): Promise<GetCorridorPricingResponseDto> {
    return this.pricingService.getCorridorPricingByCode(corridorCode);
  }

  @Get('corridors/:corridorCode/calculate')
  @ApiParam({
    name: 'corridorCode',
    description: 'Corridor code, for example FR_CM',
    example: 'FR_CM',
  })
  @ApiQuery({
    name: 'pricingModelType',
    enum: PricingModelTypeDto,
    required: true,
    example: PricingModelTypeDto.PER_KG,
  })
  @ApiQuery({
    name: 'weightKg',
    required: false,
    example: 10,
    description: 'Required only for PER_KG',
  })
  @ApiOkResponse({
    description: 'Calculated sender price / traveler gain / spread',
    type: CalculateCorridorPricingResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Pricing configuration not found',
  })
  @ApiForbiddenResponse({
    description:
      'Pricing configuration unusable or selected pricing model not configured',
  })
  async calculateCorridorPricing(
    @Param('corridorCode') corridorCode: string,
    @Query('pricingModelType') pricingModelType: PricingModelTypeDto,
    @Query('weightKg') weightKg?: string,
  ): Promise<CalculateCorridorPricingResponseDto> {
    const parsedWeightKg =
      weightKg === undefined ? undefined : Number(weightKg);

    return this.pricingService.calculateCorridorPricing(
      corridorCode,
      pricingModelType,
      parsedWeightKg,
    );
  }
}