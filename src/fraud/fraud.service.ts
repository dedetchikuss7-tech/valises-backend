import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FraudCheckResultDto } from './dto/fraud-check-result.dto';

export type FraudFlagType =
  | 'VELOCITY_TX'
  | 'DUPLICATE_ACCOUNT'
  | 'PAYOUT_FARMING'
  | 'SUSPICIOUS_PATTERN';

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
