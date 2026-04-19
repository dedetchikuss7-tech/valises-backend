import { ApiProperty } from '@nestjs/swagger';
import {
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  FlightTicketStatus,
  KycStatus,
  TrustProfileStatus,
  TripStatus,
} from '@prisma/client';

class MatchTravelerSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: KycStatus })
  kycStatus!: KycStatus;
}

class MatchTripSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TripStatus })
  status!: TripStatus;

  @ApiProperty({ enum: FlightTicketStatus })
  flightTicketStatus!: FlightTicketStatus;

  @ApiProperty()
  departAt!: Date;

  @ApiProperty({ nullable: true })
  capacityKg!: number | null;

  @ApiProperty()
  corridorId!: string;
}

class MatchTrustSummaryDto {
  @ApiProperty()
  score!: number;

  @ApiProperty({ enum: TrustProfileStatus })
  status!: TrustProfileStatus;

  @ApiProperty()
  totalEvents!: number;

  @ApiProperty()
  positiveEvents!: number;

  @ApiProperty()
  negativeEvents!: number;

  @ApiProperty()
  activeRestrictionCount!: number;
}

class MatchRestrictionSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: BehaviorRestrictionKind })
  kind!: BehaviorRestrictionKind;

  @ApiProperty({ enum: BehaviorRestrictionScope })
  scope!: BehaviorRestrictionScope;

  @ApiProperty()
  reasonCode!: string;
}

class MatchRankingBreakdownDto {
  @ApiProperty()
  corridorFitScore!: number;

  @ApiProperty()
  trustScoreComponent!: number;

  @ApiProperty()
  capacityFitScore!: number;

  @ApiProperty()
  ticketVerificationScore!: number;

  @ApiProperty()
  restrictionPenalty!: number;

  @ApiProperty()
  timingScore!: number;

  @ApiProperty()
  shortlistBoost!: number;

  @ApiProperty()
  total!: number;
}

export class MatchTripCandidateResponseDto {
  @ApiProperty()
  packageId!: string;

  @ApiProperty()
  travelerId!: string;

  @ApiProperty({ type: MatchTravelerSummaryDto })
  traveler!: MatchTravelerSummaryDto;

  @ApiProperty({ type: MatchTripSummaryDto })
  trip!: MatchTripSummaryDto;

  @ApiProperty({ type: MatchTrustSummaryDto })
  trustProfile!: MatchTrustSummaryDto;

  @ApiProperty({ type: [MatchRestrictionSummaryDto] })
  activeRestrictions!: MatchRestrictionSummaryDto[];

  @ApiProperty()
  eligible!: boolean;

  @ApiProperty()
  rankingScore!: number;

  @ApiProperty()
  rankingTier!: string;

  @ApiProperty({ type: [String] })
  rankingReasons!: string[];

  @ApiProperty({ type: [String] })
  matchWarnings!: string[];

  @ApiProperty({ type: MatchRankingBreakdownDto })
  rankingBreakdown!: MatchRankingBreakdownDto;

  @ApiProperty()
  isShortlisted!: boolean;

  @ApiProperty({ nullable: true })
  senderPriorityRank!: number | null;

  @ApiProperty({ nullable: true })
  senderPriorityLabel!: string | null;

  @ApiProperty()
  canProceedToTransaction!: boolean;
}