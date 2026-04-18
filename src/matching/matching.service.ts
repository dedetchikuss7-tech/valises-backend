import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  FlightTicketStatus,
  KycStatus,
  Role,
  TrustProfileStatus,
  TripStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type RankedCandidate = {
  packageId: string;
  travelerId: string;
  traveler: {
    id: string;
    email: string;
    kycStatus: KycStatus;
  };
  trip: {
    id: string;
    status: TripStatus;
    flightTicketStatus: FlightTicketStatus;
    departAt: Date;
    capacityKg: number | null;
    corridorId: string;
  };
  trustProfile: {
    score: number;
    status: TrustProfileStatus;
    totalEvents: number;
    positiveEvents: number;
    negativeEvents: number;
    activeRestrictionCount: number;
  };
  activeRestrictions: Array<{
    id: string;
    kind: string;
    scope: BehaviorRestrictionScope;
    reasonCode: string;
  }>;
  eligible: boolean;
  rankingScore: number;
  rankingTier: string;
  rankingReasons: string[];
  canProceedToTransaction: boolean;
};

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async listTripCandidatesForPackage(
    packageId: string,
    actorUserId: string,
    actorRole: Role,
    limit = 20,
  ): Promise<RankedCandidate[]> {
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
        status: true,
      },
    });

    if (!pkg) {
      if (actorRole === Role.ADMIN) {
        throw new NotFoundException('Package not found');
      }
      throw new ForbiddenException(
        'Package not found or not accessible for matching',
      );
    }

    const trips = await this.prisma.trip.findMany({
      where: {
        corridorId: pkg.corridorId,
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
      },
      select: {
        id: true,
        departAt: true,
        capacityKg: true,
        status: true,
        flightTicketStatus: true,
        corridorId: true,
        carrier: {
          select: {
            id: true,
            email: true,
            kycStatus: true,
          },
        },
      },
      orderBy: [{ departAt: 'asc' }],
      take: Math.max(limit * 3, limit),
    });

    const travelerIds = Array.from(new Set(trips.map((trip) => trip.carrier.id)));

    const trustProfiles =
      travelerIds.length === 0
        ? []
        : await this.prisma.userTrustProfile.findMany({
            where: {
              userId: { in: travelerIds },
            },
          });

    const restrictions =
      travelerIds.length === 0
        ? []
        : await this.prisma.behaviorRestriction.findMany({
            where: {
              userId: { in: travelerIds },
              status: BehaviorRestrictionStatus.ACTIVE,
            },
            orderBy: [{ imposedAt: 'desc' }, { createdAt: 'desc' }],
          });

    const trustProfileMap = new Map(
      trustProfiles.map((item) => [item.userId, item]),
    );

    const restrictionsByUserId = new Map<string, any[]>();
    for (const restriction of restrictions) {
      const current = restrictionsByUserId.get(restriction.userId) ?? [];
      current.push(restriction);
      restrictionsByUserId.set(restriction.userId, current);
    }

    const ranked = trips.map((trip) => {
      const trustProfile = trustProfileMap.get(trip.carrier.id) ?? {
        userId: trip.carrier.id,
        score: 100,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 0,
        positiveEvents: 0,
        negativeEvents: 0,
        activeRestrictionCount: 0,
      };

      const activeRestrictions = restrictionsByUserId.get(trip.carrier.id) ?? [];

      return this.rankCandidate({
        packageId: pkg.id,
        packageWeightKg:
          pkg.weightKg !== null && pkg.weightKg !== undefined
            ? Number(pkg.weightKg)
            : null,
        trip,
        trustProfile,
        activeRestrictions,
      });
    });

    return ranked
      .sort((a, b) => {
        if (b.eligible !== a.eligible) {
          return Number(b.eligible) - Number(a.eligible);
        }
        if (b.rankingScore !== a.rankingScore) {
          return b.rankingScore - a.rankingScore;
        }
        return new Date(a.trip.departAt).getTime() - new Date(b.trip.departAt).getTime();
      })
      .slice(0, limit);
  }

  private rankCandidate(input: {
    packageId: string;
    packageWeightKg: number | null;
    trip: {
      id: string;
      departAt: Date;
      capacityKg: number | null;
      status: TripStatus;
      flightTicketStatus: FlightTicketStatus;
      corridorId: string;
      carrier: {
        id: string;
        email: string;
        kycStatus: KycStatus;
      };
    };
    trustProfile: {
      userId: string;
      score: number;
      status: TrustProfileStatus;
      totalEvents: number;
      positiveEvents: number;
      negativeEvents: number;
      activeRestrictionCount: number;
    };
    activeRestrictions: Array<{
      id: string;
      kind: string;
      scope: BehaviorRestrictionScope;
      reasonCode: string;
    }>;
  }): RankedCandidate {
    const rankingReasons: string[] = [];
    let score = 50;

    const packageWeightKg = input.packageWeightKg;
    const tripCapacityKg =
      input.trip.capacityKg !== null && input.trip.capacityKg !== undefined
        ? Number(input.trip.capacityKg)
        : null;

    const hasBlockAccount = input.activeRestrictions.some(
      (item) => item.kind === 'BLOCK_ACCOUNT',
    );

    const hasGlobalTransactionLimit = input.activeRestrictions.some(
      (item) =>
        item.kind === 'LIMIT_TRANSACTIONS' &&
        item.scope === BehaviorRestrictionScope.GLOBAL,
    );

    const hasScopedTransactionLimit = input.activeRestrictions.some(
      (item) =>
        item.kind === 'LIMIT_TRANSACTIONS' &&
        item.scope === BehaviorRestrictionScope.TRANSACTIONS,
    );

    const hasGlobalPublishingBlock = input.activeRestrictions.some(
      (item) =>
        item.kind === 'BLOCK_PUBLISHING' &&
        item.scope === BehaviorRestrictionScope.GLOBAL,
    );

    const hasTripPublishingBlock = input.activeRestrictions.some(
      (item) =>
        item.kind === 'BLOCK_PUBLISHING' &&
        item.scope === BehaviorRestrictionScope.TRIPS,
    );

    let eligible = true;

    if (hasBlockAccount) {
      eligible = false;
      rankingReasons.push('Blocked account');
      score -= 100;
    }

    if (hasGlobalTransactionLimit || hasScopedTransactionLimit) {
      eligible = false;
      rankingReasons.push('Transaction restriction active');
      score -= 60;
    }

    if (hasGlobalPublishingBlock || hasTripPublishingBlock) {
      eligible = false;
      rankingReasons.push('Trip publishing restriction active');
      score -= 40;
    }

    if (input.trip.carrier.kycStatus === KycStatus.VERIFIED) {
      score += 20;
      rankingReasons.push('Traveler KYC verified');
    } else {
      eligible = false;
      score -= 30;
      rankingReasons.push('Traveler KYC not verified');
    }

    if (input.trustProfile.status === TrustProfileStatus.NORMAL) {
      score += 15;
      rankingReasons.push('Trust profile normal');
    } else if (input.trustProfile.status === TrustProfileStatus.UNDER_REVIEW) {
      score -= 10;
      rankingReasons.push('Trust profile under review');
    } else if (input.trustProfile.status === TrustProfileStatus.RESTRICTED) {
      eligible = false;
      score -= 50;
      rankingReasons.push('Trust profile restricted');
    }

    const normalizedTrustScore = Math.max(
      0,
      Math.min(100, input.trustProfile.score),
    );
    score += Math.round(normalizedTrustScore / 5);
    rankingReasons.push(`Trust score ${normalizedTrustScore}`);

    if (
      packageWeightKg !== null &&
      tripCapacityKg !== null &&
      tripCapacityKg >= packageWeightKg
    ) {
      score += 15;
      rankingReasons.push('Weight capacity fits package');
    } else if (packageWeightKg !== null && tripCapacityKg !== null) {
      eligible = false;
      score -= 80;
      rankingReasons.push('Insufficient weight capacity');
    } else if (packageWeightKg !== null && tripCapacityKg === null) {
      score -= 5;
      rankingReasons.push('Trip capacity not declared');
    }

    if (input.trustProfile.positiveEvents > input.trustProfile.negativeEvents) {
      score += 5;
      rankingReasons.push('Positive trust history');
    } else if (
      input.trustProfile.negativeEvents > input.trustProfile.positiveEvents
    ) {
      score -= 5;
      rankingReasons.push('Negative trust history');
    }

    const finalScore = Math.max(0, Math.min(100, score));

    let rankingTier = 'LOW_PRIORITY';
    if (eligible && finalScore >= 85) {
      rankingTier = 'HIGH_PRIORITY';
    } else if (eligible && finalScore >= 70) {
      rankingTier = 'GOOD_MATCH';
    } else if (eligible && finalScore >= 50) {
      rankingTier = 'REVIEWABLE_MATCH';
    } else if (!eligible) {
      rankingTier = 'NOT_ELIGIBLE';
    }

    return {
      packageId: input.packageId,
      travelerId: input.trip.carrier.id,
      traveler: {
        id: input.trip.carrier.id,
        email: input.trip.carrier.email,
        kycStatus: input.trip.carrier.kycStatus,
      },
      trip: {
        id: input.trip.id,
        status: input.trip.status,
        flightTicketStatus: input.trip.flightTicketStatus,
        departAt: input.trip.departAt,
        capacityKg: tripCapacityKg,
        corridorId: input.trip.corridorId,
      },
      trustProfile: {
        score: input.trustProfile.score,
        status: input.trustProfile.status,
        totalEvents: input.trustProfile.totalEvents,
        positiveEvents: input.trustProfile.positiveEvents,
        negativeEvents: input.trustProfile.negativeEvents,
        activeRestrictionCount: input.trustProfile.activeRestrictionCount,
      },
      activeRestrictions: input.activeRestrictions.map((item) => ({
        id: item.id,
        kind: item.kind,
        scope: item.scope,
        reasonCode: item.reasonCode,
      })),
      eligible,
      rankingScore: finalScore,
      rankingTier,
      rankingReasons,
      canProceedToTransaction: eligible,
    };
  }
}