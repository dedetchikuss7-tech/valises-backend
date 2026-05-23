import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  KycStatus,
  Prisma,
  TrustProfileStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { BulkActionResultDto } from '../common/dto/bulk-action-result.dto';
import { RecordReputationEventDto } from './dto/record-reputation-event.dto';
import { ImposeBehaviorRestrictionDto } from './dto/impose-behavior-restriction.dto';
import { ReleaseBehaviorRestrictionDto } from './dto/release-behavior-restriction.dto';
import {
  BehaviorRestrictionSortBy,
  ListBehaviorRestrictionsQueryDto,
  SortOrder,
} from './dto/list-behavior-restrictions-query.dto';
import { BehaviorRestrictionResponseDto } from './dto/behavior-restriction-response.dto';

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

  async getTrustProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
        deliverySuccessCount: true,
        cancellationCount: true,
        disputeCount: true,
        averageRating: true,
        reviewCount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.ensureProfile(userId);

    const badges: string[] = [];

    if (user.kycStatus === KycStatus.VERIFIED) {
      badges.push('VERIFIED_TRAVELER');
    }

    if (user.deliverySuccessCount >= 5) {
      badges.push('EXPERIENCED');
    }

    if (user.averageRating >= 4.5 && user.reviewCount >= 3) {
      badges.push('TRUSTED');
    }

    const reliabilityScore = Math.max(
      0,
      Math.min(
        100,
        100 +
          user.deliverySuccessCount * 2 -
          user.cancellationCount * 3 -
          user.disputeCount * 6,
      ),
    );

    return {
      ...profile,
      averageRating: user.averageRating,
      reviewCount: user.reviewCount,
      deliverySuccessCount: user.deliverySuccessCount,
      cancellationCount: user.cancellationCount,
      disputeCount: user.disputeCount,
      badges,
      reliabilityScore,
    };
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

  async recordEventIfMissing(
    userId: string,
    dto: RecordReputationEventDto,
    opts?: {
      dedupeScope?: 'GLOBAL' | 'TRANSACTION';
    },
  ) {
    await this.ensureUserExists(userId);
    await this.ensureProfile(userId);

    const dedupeScope = opts?.dedupeScope ?? 'TRANSACTION';

    const existing = await this.prisma.reputationEvent.findFirst({
      where: {
        userId,
        kind: dto.kind,
        reasonCode: dto.reasonCode,
        ...(dedupeScope === 'TRANSACTION'
          ? {
              transactionId: dto.transactionId ?? null,
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    if (existing) {
      const profile = await this.ensureProfile(userId);
      return {
        event: existing,
        profile,
        created: false,
      };
    }

    const result = await this.recordEvent(userId, dto);

    return {
      ...result,
      created: true,
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
        status: this.deriveProfileStatus(
          profile.score,
          nextActiveRestrictionCount,
        ),
      },
    });

    return {
      restriction: this.mapRestriction(restriction),
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
        metadata: this.mergeMetadata(restriction.metadata, {
          releaseNotes: dto.notes ?? null,
          releaseSource: 'ADMIN_MANUAL_RELEASE',
        }),
      },
    });

    const updatedProfile = await this.refreshProfileRestrictionState(
      restriction.userId,
    );

    return {
      restriction: this.mapRestriction(updatedRestriction),
      profile: updatedProfile,
    };
  }

  async expireDueRestrictions(actorUserId: string): Promise<BulkActionResultDto> {
    const now = new Date();

    const dueRestrictions = await this.prisma.behaviorRestriction.findMany({
      where: {
        status: BehaviorRestrictionStatus.ACTIVE,
        expiresAt: {
          lte: now,
        },
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });

    const results: BulkActionResultDto['results'] = [];
    const affectedUserIds = new Set<string>();

    for (const restriction of dueRestrictions) {
      try {
        await this.prisma.behaviorRestriction.update({
          where: { id: restriction.id },
          data: {
            status: BehaviorRestrictionStatus.EXPIRED,
            releasedAt: now,
            releasedById: actorUserId,
            metadata: this.mergeMetadata(restriction.metadata, {
              expiredByOperationalSweep: true,
              expiredAt: now.toISOString(),
            }),
          },
        });

        affectedUserIds.add(restriction.userId);

        results.push({
          itemId: restriction.id,
          success: true,
          message: 'EXPIRED',
        });
      } catch (error: any) {
        results.push({
          itemId: restriction.id,
          success: false,
          message: error?.message ?? 'Unknown error',
        });
      }
    }

    for (const userId of affectedUserIds) {
      await this.refreshProfileRestrictionState(userId);
    }

    const successCount = results.filter((item) => item.success).length;
    const failureCount = results.length - successCount;

    return {
      requestedCount: dueRestrictions.length,
      successCount,
      failureCount,
      results,
    };
  }

  async listRestrictions(
    query: ListBehaviorRestrictionsQueryDto,
  ): Promise<PaginatedListResponseDto<BehaviorRestrictionResponseDto>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const now = new Date();

    const rows = await this.prisma.behaviorRestriction.findMany({
      where: {
        userId: query.userId,
        status: query.status,
        kind: query.kind,
        scope: query.scope,
        ...(query.expiredOnly
          ? {
              expiresAt: {
                lte: now,
              },
            }
          : {}),
      },
      orderBy: [{ imposedAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    let items = rows.map((row) => this.mapRestriction(row, now));

    if (query.q) {
      const needle = query.q.trim().toLowerCase();

      items = items.filter((item) => {
        const haystack = [
          item.id,
          item.userId,
          item.kind,
          item.scope,
          item.status,
          item.reasonCode,
          item.reasonSummary ?? '',
          item.imposedById ?? '',
          item.releasedById ?? '',
          JSON.stringify(item.metadata ?? {}),
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    this.sortRestrictions(items, query.sortBy, query.sortOrder);

    const total = items.length;
    const pagedItems = items.slice(offset, offset + limit);

    return {
      items: pagedItems,
      total,
      limit,
      offset,
      hasMore: offset + pagedItems.length < total,
    };
  }

  private mapRestriction(
    row: any,
    now: Date = new Date(),
  ): BehaviorRestrictionResponseDto {
    const expiresAt = row.expiresAt ?? null;
    const isExpired = Boolean(expiresAt && expiresAt.getTime() <= now.getTime());

    return {
      id: row.id,
      userId: row.userId,
      kind: row.kind,
      scope: row.scope,
      status: row.status,
      reasonCode: row.reasonCode,
      reasonSummary: row.reasonSummary ?? null,
      imposedById: row.imposedById ?? null,
      releasedById: row.releasedById ?? null,
      imposedAt: row.imposedAt,
      releasedAt: row.releasedAt ?? null,
      expiresAt,
      isActive: row.status === BehaviorRestrictionStatus.ACTIVE,
      isExpired,
      metadata:
        row.metadata &&
        typeof row.metadata === 'object' &&
        !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private sortRestrictions(
    items: BehaviorRestrictionResponseDto[],
    sortBy = BehaviorRestrictionSortBy.IMPOSED_AT,
    sortOrder = SortOrder.DESC,
  ) {
    items.sort((a, b) => {
      let compare = 0;

      switch (sortBy) {
        case BehaviorRestrictionSortBy.CREATED_AT:
          compare = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case BehaviorRestrictionSortBy.UPDATED_AT:
          compare = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case BehaviorRestrictionSortBy.EXPIRES_AT:
          compare =
            (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0);
          break;
        case BehaviorRestrictionSortBy.STATUS:
          compare = a.status.localeCompare(b.status);
          break;
        case BehaviorRestrictionSortBy.KIND:
          compare = a.kind.localeCompare(b.kind);
          break;
        case BehaviorRestrictionSortBy.SCOPE:
          compare = a.scope.localeCompare(b.scope);
          break;
        case BehaviorRestrictionSortBy.IMPOSED_AT:
        default:
          compare = a.imposedAt.getTime() - b.imposedAt.getTime();
      }

      return sortOrder === SortOrder.ASC ? compare : -compare;
    });
  }

  private async refreshProfileRestrictionState(userId: string) {
    const profile = await this.ensureProfile(userId);

    const activeRestrictionCount = await this.prisma.behaviorRestriction.count({
      where: {
        userId,
        status: BehaviorRestrictionStatus.ACTIVE,
      },
    });

    return this.prisma.userTrustProfile.update({
      where: { userId },
      data: {
        activeRestrictionCount,
        status: this.deriveProfileStatus(profile.score, activeRestrictionCount),
      },
    });
  }

  private mergeMetadata(
    current: Prisma.JsonValue | null | undefined,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const base =
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
        ? (current as Record<string, unknown>)
        : {};

    return {
      ...base,
      ...patch,
    } as Prisma.InputJsonValue;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async ensureProfile(userId: string) {
    const existing = await this.prisma.userTrustProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.userTrustProfile.create({
      data: {
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

  private clampScore(value: number) {
    return Math.max(
      TrustService.MIN_SCORE,
      Math.min(TrustService.MAX_SCORE, value),
    );
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