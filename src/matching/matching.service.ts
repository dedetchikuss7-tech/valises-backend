import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  FlightTicketStatus,
  KycStatus,
  Role,
  TrustProfileStatus,
  TripStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListPackageTripCandidatesQueryDto,
  MatchSortOrder,
  MatchTripCandidatesSortBy,
} from './dto/list-package-trip-candidates-query.dto';

type PackageReadModel = {
  id: string;
  senderId: string;
  corridorId: string;
  weightKg: number;
};

type TripCandidateRow = {
  id: string;
  status: TripStatus;
  flightTicketStatus: FlightTicketStatus;
  departAt: Date;
  capacityKg: number | null;
  corridorId: string;
  carrier: {
    id: string;
    email: string;
    kycStatus: KycStatus;
  };
};

type TrustProfileRow = {
  score: number;
  status: TrustProfileStatus;
  totalEvents: number;
  positiveEvents: number;
  negativeEvents: number;
  activeRestrictionCount: number;
};

type RestrictionRow = {
  id: string;
  kind: BehaviorRestrictionKind;
  scope: BehaviorRestrictionScope;
  reasonCode: string;
};

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async listTripCandidatesForPackage(
    packageId: string,
    actorUserId: string,
    actorRole: Role,
    query: ListPackageTripCandidatesQueryDto,
  ) {
    const pkg = await this.prisma.package.findFirst({
      where:
        actorRole === Role.ADMIN
          ? { id: packageId }
          : {
              id: packageId,
              senderId: actorUserId,
            },
      select: {
        id: true,
        senderId: true,
        corridorId: true,
        weightKg: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException(
        'Package not found or not accessible for matching',
      );
    }

    if (actorRole !== Role.ADMIN && pkg.senderId !== actorUserId) {
      throw new ForbiddenException(
        'Only the sender or an admin can list trip candidates for this package',
      );
    }

    const trips = await this.prisma.trip.findMany({
      where: {
        corridorId: pkg.corridorId,
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
      },
      orderBy: [{ departAt: 'asc' }],
      include: {
        carrier: {
          select: {
            id: true,
            email: true,
            kycStatus: true,
          },
        },
      },
      take: 200,
    });

    const candidates = await Promise.all(
      trips.map((trip) =>
        this.buildCandidate(
          pkg as PackageReadModel,
          trip as unknown as TripCandidateRow,
        ),
      ),
    );

    const filtered = this.applyFilters(candidates, query);
    const sorted = this.applySorting(filtered, query);

    return sorted.slice(0, query.limit ?? 20);
  }

  private async buildCandidate(
    pkg: PackageReadModel,
    trip: TripCandidateRow,
  ) {
    const trustProfile = await this.readTrustProfile(trip.carrier.id);
    const activeRestrictions = await this.readActiveRestrictions(trip.carrier.id);

    const capacityKg =
      trip.capacityKg !== null && trip.capacityKg !== undefined
        ? Number(trip.capacityKg)
        : null;

    const packageWeightKg = Number(pkg.weightKg);

    const hasBlockingRestriction = activeRestrictions.some(
      (restriction) =>
        restriction.kind === BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
    );

    const capacityFit =
      capacityKg === null ? true : Number.isFinite(capacityKg) && capacityKg >= packageWeightKg;

    const corridorFitScore = trip.corridorId === pkg.corridorId ? 25 : 0;
    const trustScoreComponent = Math.round((trustProfile.score / 100) * 35);
    const capacityFitScore = capacityFit ? 15 : -10;
    const ticketVerificationScore =
      trip.flightTicketStatus === FlightTicketStatus.VERIFIED ? 10 : 0;
    const restrictionPenalty = hasBlockingRestriction
      ? -30
      : activeRestrictions.length > 0
        ? -10
        : 0;
    const timingScore = this.computeTimingScore(trip.departAt);

    const total =
      corridorFitScore +
      trustScoreComponent +
      capacityFitScore +
      ticketVerificationScore +
      restrictionPenalty +
      timingScore;

    const rankingReasons: string[] = [];
    const matchWarnings: string[] = [];

    if (trip.corridorId === pkg.corridorId) {
      rankingReasons.push('Same corridor as package');
    }

    if (trip.flightTicketStatus === FlightTicketStatus.VERIFIED) {
      rankingReasons.push('Flight ticket verified');
    }

    if (trustProfile.score >= 80) {
      rankingReasons.push('Strong traveler trust profile');
    } else if (trustProfile.score >= 60) {
      rankingReasons.push('Acceptable traveler trust profile');
    }

    if (capacityFit) {
      rankingReasons.push('Capacity looks compatible with package weight');
    } else {
      matchWarnings.push('Capacity may be insufficient for package weight');
    }

    if (trustProfile.status === TrustProfileStatus.UNDER_REVIEW) {
      matchWarnings.push('Traveler trust profile is under review');
    }

    if (activeRestrictions.length > 0) {
      matchWarnings.push('Traveler has active restrictions');
    }

    if (trip.carrier.kycStatus !== KycStatus.VERIFIED) {
      matchWarnings.push('Traveler KYC is not VERIFIED');
    }

    const eligible =
      trip.status === TripStatus.ACTIVE &&
      trip.flightTicketStatus === FlightTicketStatus.VERIFIED &&
      trip.carrier.kycStatus === KycStatus.VERIFIED &&
      capacityFit &&
      !hasBlockingRestriction;

    return {
      packageId: pkg.id,
      travelerId: trip.carrier.id,
      traveler: {
        id: trip.carrier.id,
        email: trip.carrier.email,
        kycStatus: trip.carrier.kycStatus,
      },
      trip: {
        id: trip.id,
        status: trip.status,
        flightTicketStatus: trip.flightTicketStatus,
        departAt: trip.departAt,
        capacityKg,
        corridorId: trip.corridorId,
      },
      trustProfile,
      activeRestrictions,
      eligible,
      rankingScore: total,
      rankingTier: this.resolveRankingTier(total),
      rankingReasons,
      matchWarnings,
      rankingBreakdown: {
        corridorFitScore,
        trustScoreComponent,
        capacityFitScore,
        ticketVerificationScore,
        restrictionPenalty,
        timingScore,
        total,
      },
      canProceedToTransaction: eligible,
    };
  }

  private async readTrustProfile(userId: string): Promise<TrustProfileRow> {
    const profile = await this.prisma.userTrustProfile.findUnique({
      where: { userId },
      select: {
        score: true,
        status: true,
        totalEvents: true,
        positiveEvents: true,
        negativeEvents: true,
        activeRestrictionCount: true,
      },
    });

    if (profile) {
      return {
        score: profile.score,
        status: profile.status,
        totalEvents: profile.totalEvents,
        positiveEvents: profile.positiveEvents,
        negativeEvents: profile.negativeEvents,
        activeRestrictionCount: profile.activeRestrictionCount,
      };
    }

    return {
      score: 100,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 0,
      positiveEvents: 0,
      negativeEvents: 0,
      activeRestrictionCount: 0,
    };
  }

  private async readActiveRestrictions(userId: string): Promise<RestrictionRow[]> {
    const restrictions = await this.prisma.behaviorRestriction.findMany({
      where: {
        userId,
        status: BehaviorRestrictionStatus.ACTIVE,
      },
      select: {
        id: true,
        kind: true,
        scope: true,
        reasonCode: true,
      },
      orderBy: [{ imposedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return restrictions.map((restriction) => ({
      id: restriction.id,
      kind: restriction.kind,
      scope: restriction.scope,
      reasonCode: restriction.reasonCode,
    }));
  }

  private computeTimingScore(departAt: Date) {
    const diffMs = departAt.getTime() - Date.now();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 0) {
      return -20;
    }
    if (diffDays <= 3) {
      return 15;
    }
    if (diffDays <= 7) {
      return 10;
    }
    if (diffDays <= 14) {
      return 5;
    }
    return 0;
  }

  private resolveRankingTier(score: number) {
    if (score >= 75) {
      return 'STRONG';
    }
    if (score >= 50) {
      return 'GOOD';
    }
    if (score >= 25) {
      return 'MEDIUM';
    }
    return 'WEAK';
  }

  private applyFilters(
    candidates: any[],
    query: ListPackageTripCandidatesQueryDto,
  ) {
    return candidates.filter((candidate) => {
      if (
        query.minTravelerTrustScore !== undefined &&
        candidate.trustProfile.score < query.minTravelerTrustScore
      ) {
        return false;
      }

      if (query.verifiedOnly && candidate.traveler.kycStatus !== KycStatus.VERIFIED) {
        return false;
      }

      if (
        query.withAvailableCapacityOnly &&
        candidate.trip.capacityKg !== null &&
        candidate.trip.capacityKg < candidate.rankingBreakdown.capacityFitScore
      ) {
        return false;
      }

      if (
        query.withAvailableCapacityOnly &&
        candidate.matchWarnings.includes(
          'Capacity may be insufficient for package weight',
        )
      ) {
        return false;
      }

      if (
        query.excludeRestricted &&
        candidate.activeRestrictions.some(
          (restriction: RestrictionRow) =>
            restriction.kind === BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
        )
      ) {
        return false;
      }

      return true;
    });
  }

  private applySorting(
    candidates: any[],
    query: ListPackageTripCandidatesQueryDto,
  ) {
    const sortBy = query.sortBy ?? MatchTripCandidatesSortBy.SCORE;
    const sortOrder = query.sortOrder ?? MatchSortOrder.DESC;
    const direction = sortOrder === MatchSortOrder.ASC ? 1 : -1;

    return [...candidates].sort((a, b) => {
      let left: number;
      let right: number;

      if (sortBy === MatchTripCandidatesSortBy.DEPARTURE_SOONEST) {
        left = new Date(a.trip.departAt).getTime();
        right = new Date(b.trip.departAt).getTime();
      } else if (sortBy === MatchTripCandidatesSortBy.TRAVELER_TRUST_SCORE) {
        left = a.trustProfile.score;
        right = b.trustProfile.score;
      } else {
        left = a.rankingScore;
        right = b.rankingScore;
      }

      if (left < right) {
        return -1 * direction;
      }
      if (left > right) {
        return 1 * direction;
      }

      return 0;
    });
  }
}