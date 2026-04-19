import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export enum MatchTripCandidatesSortBy {
  SCORE = 'score',
  DEPARTURE_SOONEST = 'departureSoonest',
  TRAVELER_TRUST_SCORE = 'travelerTrustScore',
}

export enum MatchSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListPackageTripCandidatesQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of ranked trip candidates to return',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Minimum traveler trust score required',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minTravelerTrustScore?: number;

  @ApiPropertyOptional({
    description: 'Only keep travelers with VERIFIED KYC',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  verifiedOnly?: boolean = false;

  @ApiPropertyOptional({
    description:
      'Only keep trips where current capacity can fit the package weight',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  withAvailableCapacityOnly?: boolean = false;

  @ApiPropertyOptional({
    description:
      'Exclude candidates with active blocking / limiting restrictions',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  excludeRestricted?: boolean = false;

  @ApiPropertyOptional({
    description: 'Sort field for ranked candidates',
    enum: MatchTripCandidatesSortBy,
    default: MatchTripCandidatesSortBy.SCORE,
  })
  @IsOptional()
  @IsEnum(MatchTripCandidatesSortBy)
  sortBy?: MatchTripCandidatesSortBy = MatchTripCandidatesSortBy.SCORE;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: MatchSortOrder,
    default: MatchSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(MatchSortOrder)
  sortOrder?: MatchSortOrder = MatchSortOrder.DESC;
}