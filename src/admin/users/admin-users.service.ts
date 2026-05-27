import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminUserListQueryDto } from './dto/admin-user-list.dto';
import { AdminKycOverrideDto, AdminKycOverrideStatus } from './dto/admin-kyc-override.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: AdminUserListQueryDto) {
    const limit = Math.min(query.limit ?? 20, 100);

    const where: Record<string, any> = {};

    if (query.email) {
      where.email = { contains: query.email, mode: 'insensitive' };
    }

    if (query.kycStatus) {
      where.kycStatus = query.kycStatus;
    }

    if (query.suspended === 'true') {
      where.suspendedAt = { not: null };
    }

    if (query.banned === 'true') {
      where.bannedAt = { not: null };
    }

    // trustLevel is computed from UserTrustProfile.score — filter post-query
    const fetchLimit = query.trustLevel ? limit * 5 : limit + 1;

    const users = await this.prisma.user.findMany({
      where,
      take: fetchLimit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        kycStatus: true,
        kycAttemptCount: true,
        suspendedAt: true,
        suspendedReason: true,
        bannedAt: true,
        bannedReason: true,
        createdAt: true,
        trustProfile: {
          select: { score: true },
        },
        _count: {
          select: {
            sentTransactions: true,
            travelTransactions: true,
          },
        },
      },
    });

    // TrustLevel enum: EXPLORER (<20), VERIFIED (20-49), TRUSTED (50-79), HIGH_TRUST (>=80)
    let filtered = users;
    if (query.trustLevel) {
      filtered = users.filter((u) => {
        const score = u.trustProfile?.score ?? 0;
        switch (query.trustLevel) {
          case 'EXPLORER':   return score < 20;
          case 'VERIFIED':   return score >= 20 && score < 50;
          case 'TRUSTED':    return score >= 50 && score < 80;
          case 'HIGH_TRUST': return score >= 80;
          default:           return true;
        }
      });
    }

    const paginated = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const nextCursor = hasMore ? paginated[paginated.length - 1]?.id : null;

    return {
      data: paginated,
      nextCursor,
      hasMore,
    };
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        kycStatus: true,
        kycAttemptCount: true,
        kycRejectionReason: true,
        kycLastAttemptAt: true,
        suspendedAt: true,
        suspendedReason: true,
        suspendedUntil: true,
        bannedAt: true,
        bannedReason: true,
        appealRequestedAt: true,
        createdAt: true,
        updatedAt: true,
        trustProfile: {
          select: { score: true, status: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const activeFraudFlags = await this.prisma.fraudFlag.findMany({
      where: { userId, resolvedAt: null },
      select: {
        id: true,
        type: true,
        severity: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const [senderCount, carrierCount] = await Promise.all([
      this.prisma.transaction.count({ where: { senderId: userId } }),
      this.prisma.transaction.count({ where: { travelerId: userId } }),
    ]);

    const score = user.trustProfile?.score ?? 0;
    let trustLevel: string;
    if (score >= 80)      trustLevel = 'HIGH_TRUST';
    else if (score >= 50) trustLevel = 'TRUSTED';
    else if (score >= 20) trustLevel = 'VERIFIED';
    else                  trustLevel = 'EXPLORER';

    return {
      ...user,
      trustLevel,
      activeFraudFlags,
      transactionStats: {
        asSender: senderCount,
        asCarrier: carrierCount,
        total: senderCount + carrierCount,
      },
    };
  }

  async overrideKycStatus(
    targetUserId: string,
    adminId: string,
    dto: AdminKycOverrideDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, kycStatus: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException('reason is mandatory and must be at least 10 characters');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        kycStatus: dto.status,
        kycRejectionReason:
          dto.status === AdminKycOverrideStatus.VERIFIED
            ? null
            : `[ADMIN OVERRIDE] ${dto.reason}`,
      },
      select: {
        id: true,
        kycStatus: true,
        kycRejectionReason: true,
      },
    });

    await this.prisma.adminActionAudit.create({
      data: {
        actorUserId: adminId,
        action: `KYC_STATUS_OVERRIDE`,
        targetType: 'USER',
        targetId: targetUserId,
        metadata: {
          previousStatus: user.kycStatus,
          newStatus: dto.status,
          reason: dto.reason,
        },
      },
    });

    return {
      userId: targetUserId,
      kycStatus: updatedUser.kycStatus,
      overriddenBy: adminId,
      reason: dto.reason,
      overriddenAt: new Date().toISOString(),
    };
  }
}
