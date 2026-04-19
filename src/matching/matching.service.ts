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
import { UpsertPackageTripShortlistDto } from './dto/upsert-package-trip-shortlist.dto';

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

type ShortlistRow = {
  id: string;
  packageId: string;
  tripId: string;
  senderId: string;
  travelerId: string;
  priorityRank: number;
  note: string | null;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
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
    const pkg = await this.getAccessiblePackage(packageId, actorUserId, actorRole);

    const shortlistEntries = await this.prisma.packageTripShortlist.findMany({
      where: { packageId: pkg.id },
      select: {
        id: true,
        packageId: true,
        tripId: true,
        senderId: true,
        travelerId: true,
        priorityRank: true,
        note: true,
        isVisible: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const shortlistMap = new Map(
      shortlistEntries.map((entry) => [entry.tripId, entry]),
    );

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
          shortlistMap.get(trip.id) ?? null,
        ),
      ),
    );

    const filtered = this.applyFilters(candidates, query);
    const sorted = this.applySorting(filtered, query);

    return sorted.slice(0, query.limit ?? 20);
  }

  async shortlistTripForPackage(
    packageId: string,
    tripId: string,
    actorUserId: string,
    actorRole: Role,
    dto: UpsertPackageTripShortlistDto,
  ) {
    const pkg = await this.getAccessiblePackage(packageId, actorUserId, actorRole);
    const trip = await this.getShortlistableTrip(tripId, pkg.corridorId);

    const entry = await this.prisma.packageTripShortlist.upsert({
      where: {
        packageId_tripId: {
          packageId: pkg.id,
          tripId: trip.id,
        },
      },
      update: {
        senderId: pkg.senderId,
        travelerId: trip.carrier.id,
        priorityRank: dto.priorityRank ?? 100,
        note: dto.note ?? null,
        isVisible: dto.isVisible ?? true,
      },
      create: {
        packageId: pkg.id,
        tripId: trip.id,
        senderId: pkg.senderId,
        travelerId: trip.carrier.id,
        priorityRank: dto.priorityRank ?? 100,
        note: dto.note ?? null,
        isVisible: dto.isVisible ?? true,
      },
      include: {
        trip: true,
        traveler: true,
      },
    });

    return this.mapShortlistEntry(entry);
  }

  async removeShortlistedTripForPackage(
    packageId: string,
    tripId: string,
    actorUserId: string,
    actorRole: Role,
  ) {
    await this.getAccessiblePackage(packageId, actorUserId, actorRole);

    const result = await this.prisma.packageTripShortlist.deleteMany({
      where: {
        packageId,
        tripId,
      },
    });

    return {
      packageId,
      tripId,
      removed: result.count > 0,
    };
  }

  async listShortlistForPackage(
    packageId: string,
    actorUserId: string,
    actorRole: Role,
  ) {
    await this.getAccessiblePackage(packageId, actorUserId, actorRole);

    const entries = await this.prisma.packageTripShortlist.findMany({
      where: { packageId },
      orderBy: [{ priorityRank: 'asc' }, { createdAt: 'asc' }],
      include: {
        trip: true,
        traveler: true,
      },
    });

    return entries.map((entry) => this.mapShortlistEntry(entry));
  }

  private async getAccessiblePackage(
    packageId: string,
    actorUserId: string,
    actorRole: Role,
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
        'Only the sender or an admin can access matching for this package',
      );
    }

    return pkg;
  }

  private async getShortlistableTrip(tripId: string, corridorId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        carrier: {
          select: {
            id: true,
            email: true,
            kycStatus: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.corridorId !== corridorId) {
      throw new ForbiddenException(
        'Trip corridor does not match the package corridor',
      );
    }

    if (trip.status !== TripStatus.ACTIVE) {
      throw new ForbiddenException('Only ACTIVE trips can be shortlisted');
    }

    if (trip.flightTicketStatus !== FlightTicketStatus.VERIFIED) {
      throw new ForbiddenException(
        'Only VERIFIED-ticket trips can be shortlisted',
      );
    }

    return trip;
  }

  private async buildCandidate(
    pkg: PackageReadModel,
    trip: TripCandidateRow,
    shortlistEntry: ShortlistRow | null,
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
        restriction.kind === BehaviorRestrictionKind.LIMIT_TRANSACTIONS ||
        restriction.kind === BehaviorRestrictionKind.BLOCK_ACCOUNT,
    );

    const capacityFits =
      capacityKg === null
        ? true
        : Number.isFinite(capacityKg) && capacityKg >= packageWeightKg;

    const isShortlisted = Boolean(shortlistEntry?.isVisible);
    const senderPriorityRank = shortlistEntry?.priorityRank ?? null;
    const shortlistBoost = this.computeShortlistBoost(senderPriorityRank);

    const corridorFitScore = trip.corridorId === pkg.corridorId ? 25 : 0;
    const trustScoreComponent = Math.round((trustProfile.score / 100) * 35);
    const capacityFitScore = capacityFits ? 15 : -10;
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
      timingScore +
      shortlistBoost;

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

    if (capacityFits) {
      rankingReasons.push('Capacity looks compatible with package weight');
    } else {
      matchWarnings.push('Capacity may be insufficient for package weight');
    }

    if (isShortlisted) {
      rankingReasons.push('Shortlisted by sender');
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
      capacityFits &&
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
        shortlistBoost,
        total,
      },
      isShortlisted,
      senderPriorityRank,
      senderPriorityLabel: this.resolveSenderPriorityLabel(senderPriorityRank),
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

  private computeShortlistBoost(priorityRank: number | null) {
    if (priorityRank === null) {
      return 0;
    }
    if (priorityRank <= 3) {
      return 20;
    }
    if (priorityRank <= 10) {
      return 12;
    }
    if (priorityRank <= 25) {
      return 6;
    }
    return 3;
  }

  private resolveSenderPriorityLabel(priorityRank: number | null) {
    if (priorityRank === null) {
      return null;
    }
    if (priorityRank <= 3) {
      return 'TOP_PRIORITY';
    }
    if (priorityRank <= 10) {
      return 'HIGH_PRIORITY';
    }
    if (priorityRank <= 25) {
      return 'MEDIUM_PRIORITY';
    }
    return 'LOW_PRIORITY';
  }

  private resolveRankingTier(score: number) {
    if (score >= 85) {
      return 'TOP';
    }
    if (score >= 70) {
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

      if (
        query.verifiedOnly &&
        candidate.traveler.kycStatus !== KycStatus.VERIFIED
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
            restriction.kind === BehaviorRestrictionKind.LIMIT_TRANSACTIONS ||
            restriction.kind === BehaviorRestrictionKind.BLOCK_ACCOUNT,
        )
      ) {
        return false;
      }

      if (query.shortlistedOnly && !candidate.isShortlisted) {
        return false;
      }

      return true;
    });
  }

  private applySorting(
    candidates: any[],
    query: ListPackageTripCandidatesQueryDto,
  ) {
    const sortBy =
      query.sortBy ?? MatchTripCandidatesSortBy.SCORE;
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
      } else if (sortBy === MatchTripCandidatesSortBy.SHORTLIST_PRIORITY) {
        left = a.senderPriorityRank ?? 999999;
        right = b.senderPriorityRank ?? 999999;
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

      if (a.isShortlisted && !b.isShortlisted) {
        return -1;
      }
      if (!a.isShortlisted && b.isShortlisted) {
        return 1;
      }

      return 0;
    });
  }

  private mapShortlistEntry(entry: any) {
    return {
      id: entry.id,
      packageId: entry.packageId,
      tripId: entry.tripId,
      senderId: entry.senderId,
      travelerId: entry.travelerId,
      priorityRank: entry.priorityRank,
      note: entry.note ?? null,
      isVisible: entry.isVisible,
      traveler: {
        id: entry.traveler.id,
        email: entry.traveler.email,
        kycStatus: entry.traveler.kycStatus,
      },
      trip: {
        id: entry.trip.id,
        status: entry.trip.status,
        flightTicketStatus: entry.trip.flightTicketStatus,
        departAt: entry.trip.departAt,
        capacityKg:
          entry.trip.capacityKg !== null && entry.trip.capacityKg !== undefined
            ? Number(entry.trip.capacityKg)
            : null,
        corridorId: entry.trip.corridorId,
      },
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}