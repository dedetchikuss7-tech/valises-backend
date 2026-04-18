import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  Prisma,
  TrustProfileStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecordReputationEventDto } from './dto/record-reputation-event.dto';
import { ImposeBehaviorRestrictionDto } from './dto/impose-behavior-restriction.dto';
import { ReleaseBehaviorRestrictionDto } from './dto/release-behavior-restriction.dto';
import { ListBehaviorRestrictionsQueryDto } from './dto/list-behavior-restrictions-query.dto';

@Injectable()
export class TrustService {
  private static readonly DEFAULT_SCORE = 100;
  private static readonly MIN_SCORE = 0;
  private static readonly MAX_SCORE = 100;
  private static readonly UNDER_REVIEW_THRESHOLD = 70;

  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    await this.ensureUserExists(userId);
    return this.ensureProfile(userId);
  }

  async recordEvent(userId: string, dto: RecordReputationEventDto) {
    await this.ensureUserExists(userId);

    const profile = await this.ensureProfile(userId);

    const event = await this.prisma.reputationEvent.create({
      data: {
        userId,
        transactionId: dto.transactionId ?? null,
        kind: dto.kind,
        scoreDelta: dto.scoreDelta,
        reasonCode: dto.reasonCode,
        reasonSummary: dto.reasonSummary ?? null,
        metadata: dto.metadata
          ? (dto.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });

    const nextScore = this.clampScore(profile.score + dto.scoreDelta);
    const nextTotalEvents = profile.totalEvents + 1;
    const nextPositiveEvents =
      profile.positiveEvents + (dto.scoreDelta > 0 ? 1 : 0);
    const nextNegativeEvents =
      profile.negativeEvents + (dto.scoreDelta < 0 ? 1 : 0);

    const updatedProfile = await this.prisma.userTrustProfile.update({
      where: { userId },
      data: {
        score: nextScore,
        totalEvents: nextTotalEvents,
        positiveEvents: nextPositiveEvents,
        negativeEvents: nextNegativeEvents,
        lastEventAt: event.createdAt,
        status: this.deriveProfileStatus(
          nextScore,
          profile.activeRestrictionCount,
        ),
      },
    });

    return {
      event,
      profile: updatedProfile,
    };
  }

  async imposeRestriction(
    userId: string,
    dto: ImposeBehaviorRestrictionDto,
    actorUserId: string,
  ) {
    await this.ensureUserExists(userId);
    const profile = await this.ensureProfile(userId);

    const restriction = await this.prisma.behaviorRestriction.create({
      data: {
        userId,
        kind: dto.kind,
        scope: dto.scope ?? BehaviorRestrictionScope.GLOBAL,
        status: BehaviorRestrictionStatus.ACTIVE,
        reasonCode: dto.reasonCode,
        reasonSummary: dto.reasonSummary ?? null,
        metadata: dto.metadata
          ? (dto.metadata as Prisma.InputJsonValue)
          : undefined,
        imposedById: actorUserId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    const nextActiveRestrictionCount = profile.activeRestrictionCount + 1;

    const updatedProfile = await this.prisma.userTrustProfile.update({
      where: { userId },
      data: {
        activeRestrictionCount: nextActiveRestrictionCount,
        status: this.deriveProfileStatus(profile.score, nextActiveRestrictionCount),
      },
    });

    return {
      restriction,
      profile: updatedProfile,
    };
  }

  async releaseRestriction(
    restrictionId: string,
    dto: ReleaseBehaviorRestrictionDto,
    actorUserId: string,
  ) {
    const restriction = await this.prisma.behaviorRestriction.findUnique({
      where: { id: restrictionId },
    });

    if (!restriction) {
      throw new NotFoundException('Behavior restriction not found');
    }

    if (restriction.status !== BehaviorRestrictionStatus.ACTIVE) {
      throw new BadRequestException(
        'Only ACTIVE behavior restrictions can be released',
      );
    }

    const updatedRestriction = await this.prisma.behaviorRestriction.update({
      where: { id: restrictionId },
      data: {
        status: BehaviorRestrictionStatus.RELEASED,
        releasedById: actorUserId,
        releasedAt: new Date(),
        metadata: dto.notes
          ? ({
              releaseNotes: dto.notes,
            } as Prisma.InputJsonValue)
          : undefined,
      },
    });

    const profile = await this.ensureProfile(restriction.userId);

    const activeRestrictionCount = await this.prisma.behaviorRestriction.count({
      where: {
        userId: restriction.userId,
        status: BehaviorRestrictionStatus.ACTIVE,
      },
    });

    const updatedProfile = await this.prisma.userTrustProfile.update({
      where: { userId: restriction.userId },
      data: {
        activeRestrictionCount,
        status: this.deriveProfileStatus(profile.score, activeRestrictionCount),
      },
    });

    return {
      restriction: updatedRestriction,
      profile: updatedProfile,
    };
  }

  async listRestrictions(query: ListBehaviorRestrictionsQueryDto) {
    return this.prisma.behaviorRestriction.findMany({
      where: {
        userId: query.userId,
        status: query.status,
        scope: query.scope,
      },
      orderBy: [{ imposedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.limit ?? 50,
    });
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return user;
  }

  private async ensureProfile(userId: string) {
    return this.prisma.userTrustProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        score: TrustService.DEFAULT_SCORE,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 0,
        positiveEvents: 0,
        negativeEvents: 0,
        activeRestrictionCount: 0,
      },
    });
  }

  private clampScore(value: number): number {
    if (value < TrustService.MIN_SCORE) {
      return TrustService.MIN_SCORE;
    }

    if (value > TrustService.MAX_SCORE) {
      return TrustService.MAX_SCORE;
    }

    return value;
  }

  private deriveProfileStatus(
    score: number,
    activeRestrictionCount: number,
  ): TrustProfileStatus {
    if (activeRestrictionCount > 0) {
      return TrustProfileStatus.RESTRICTED;
    }

    if (score < TrustService.UNDER_REVIEW_THRESHOLD) {
      return TrustProfileStatus.UNDER_REVIEW;
    }

    return TrustProfileStatus.NORMAL;
  }
}