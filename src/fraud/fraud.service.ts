import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FraudCheckResultDto } from './dto/fraud-check-result.dto';

export type FraudFlagType =
  | 'VELOCITY_TX'
  | 'DUPLICATE_ACCOUNT'
  | 'PAYOUT_FARMING'
  | 'SUSPICIOUS_PATTERN'
  | 'MULTI_ACCOUNT'
  | 'IMPOSSIBLE_TRAVEL'
  | 'PAYOUT_FARMING_V2';

export type FraudFlagSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

@Injectable()
export class FraudService {
  private static readonly VELOCITY_WINDOW_HOURS = 24;
  private static readonly VELOCITY_TX_LIMIT = 5;
  private static readonly PAYOUT_COOLDOWN_HOURS = 6;

  constructor(private readonly prisma: PrismaService) {}

  async checkTransactionVelocity(userId: string): Promise<FraudCheckResultDto> {
    const windowStart = new Date(
      Date.now() -
        FraudService.VELOCITY_WINDOW_HOURS * 60 * 60 * 1000,
    );

    const count = await this.prisma.transaction.count({
      where: {
        senderId: userId,
        createdAt: { gte: windowStart },
      },
    });

    if (count >= FraudService.VELOCITY_TX_LIMIT) {
      await this.flagUser(
        userId,
        'VELOCITY_TX',
        'HIGH',
        `User created ${count} transactions in the last ${FraudService.VELOCITY_WINDOW_HOURS}h (limit: ${FraudService.VELOCITY_TX_LIMIT})`,
        { count, windowHours: FraudService.VELOCITY_WINDOW_HOURS },
      );
      return { blocked: true, reason: 'FRAUD_VELOCITY_LIMIT' };
    }

    return { blocked: false };
  }

  async checkPayoutCooldown(userId: string): Promise<FraudCheckResultDto> {
    const cooldownStart = new Date(
      Date.now() -
        FraudService.PAYOUT_COOLDOWN_HOURS * 60 * 60 * 1000,
    );

    const recentPayout = await this.prisma.payout.findFirst({
      where: {
        transaction: { travelerId: userId },
        status: 'PAID',
        updatedAt: { gte: cooldownStart },
      },
      select: { id: true, updatedAt: true },
    });

    if (recentPayout) {
      return { blocked: true, reason: 'PAYOUT_COOLDOWN_ACTIVE' };
    }

    return { blocked: false };
  }

  async flagUser(
    userId: string,
    type: FraudFlagType,
    severity: FraudFlagSeverity,
    description: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.fraudFlag.create({
      data: {
        userId,
        type,
        severity,
        description,
        metadata: metadata
          ? (metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  private normalizeEmail(email: string): { localPart: string; domain: string } {
    const lower = email.toLowerCase();
    const atIndex = lower.lastIndexOf('@');
    const local = lower.slice(0, atIndex);
    const domain = lower.slice(atIndex + 1);

    if (domain === 'gmail.com') {
      const withoutAlias = local.split('+')[0];
      const withoutDots = withoutAlias.replace(/\./g, '');
      return { localPart: withoutDots, domain };
    }

    return { localPart: local, domain };
  }

  async checkMultiAccount(userId: string): Promise<FraudCheckResultDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) return { blocked: false };

    const { localPart, domain } = this.normalizeEmail(user.email);

    const similarUsers = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        email: {
          startsWith: localPart,
          contains: domain,
        },
      },
      select: { id: true, email: true, createdAt: true },
      take: 10,
    });

    if (similarUsers.length >= 2) {
      await this.flagUser(
        userId,
        'MULTI_ACCOUNT',
        'HIGH',
        `Multi-account detected: ${similarUsers.length} similar accounts found`,
        { similarUserIds: similarUsers.map((u) => u.id) },
      );
      return {
        blocked: false,
        flagged: true,
        reason: 'MULTI_ACCOUNT_DETECTED',
        relatedUserIds: similarUsers.map((u) => u.id),
      };
    }

    return { blocked: false };
  }

  async checkImpossibleTravel(
    userId: string,
    cityFrom: string,
    cityTo: string,
  ): Promise<FraudCheckResultDto> {
    const recentTrips = await this.prisma.trip.findMany({
      where: {
        carrierId: userId,
        createdAt: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) },
      },
      select: {
        corridor: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (recentTrips.length === 0) return { blocked: false };

    const lastTrip = recentTrips[0];
    const timeDiff = Date.now() - lastTrip.createdAt.getTime();
    const twoHoursMs = 2 * 60 * 60 * 1000;

    if (timeDiff < twoHoursMs) {
      const arrivalLocation = (lastTrip.corridor?.name ?? '').toLowerCase().trim();
      const normalizedCityFrom = cityFrom.toLowerCase().trim();
      if (arrivalLocation && arrivalLocation !== normalizedCityFrom) {
        await this.flagUser(
          userId,
          'IMPOSSIBLE_TRAVEL',
          'MEDIUM',
          `Impossible travel: last corridor "${lastTrip.corridor?.name}" conflicts with departure from "${cityFrom}"`,
          { corridorName: lastTrip.corridor?.name, cityFrom, cityTo },
        );
        return { blocked: false, flagged: true, reason: 'IMPOSSIBLE_TRAVEL_DETECTED' };
      }
    }

    return { blocked: false };
  }

  async checkPayoutFarmingV2(userId: string): Promise<FraudCheckResultDto> {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [recentPaidPayouts, payoutAggregate] = await Promise.all([
      this.prisma.payout.count({
        where: {
          transaction: { travelerId: userId },
          status: 'PAID',
          updatedAt: { gte: since30d },
        },
      }),
      this.prisma.payout.aggregate({
        where: {
          transaction: { travelerId: userId },
          status: 'PAID',
          updatedAt: { gte: since30d },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalAmount = payoutAggregate._sum.amount ?? 0;

    if (recentPaidPayouts > 15 || totalAmount > 500000) {
      await this.flagUser(
        userId,
        'PAYOUT_FARMING_V2',
        'HIGH',
        `Payout farming V2 detected: ${recentPaidPayouts} payouts totalling ${totalAmount} in 30 days`,
        { count: recentPaidPayouts, totalAmount },
      );
      return {
        blocked: false,
        flagged: true,
        reason: 'PAYOUT_FARMING_DETECTED',
        metadata: { count: recentPaidPayouts, totalAmount },
      };
    }

    return { blocked: false };
  }

  async runFullFraudCheck(userId: string): Promise<{
    userId: string;
    checkedAt: string;
    blocked: boolean;
    blockReason: string | null;
    flags: FraudCheckResultDto[];
    flagCount: number;
  }> {
    const [velocity, payoutCooldown, multiAccount, payoutFarming] =
      await Promise.all([
        this.checkTransactionVelocity(userId),
        this.checkPayoutCooldown(userId),
        this.checkMultiAccount(userId),
        this.checkPayoutFarmingV2(userId),
      ]);

    const results = [velocity, payoutCooldown, multiAccount, payoutFarming];
    const blocked = results.some((r) => r.blocked);
    const blockReason = results.find((r) => r.blocked)?.reason ?? null;

    return {
      userId,
      checkedAt: new Date().toISOString(),
      blocked,
      blockReason,
      flags: results,
      flagCount: results.filter((r) => r.blocked || (r as any).flagged).length,
    };
  }

  async getActiveFlags(userId: string) {
    return this.prisma.fraudFlag.findMany({
      where: {
        userId,
        resolvedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveFlag(flagId: string) {
    return this.prisma.fraudFlag.update({
      where: { id: flagId },
      data: { resolvedAt: new Date() },
    });
  }
}
