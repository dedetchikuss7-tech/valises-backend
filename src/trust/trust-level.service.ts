import { Injectable } from '@nestjs/common';
import { KycStatus, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrustLevel, TrustLevelResult } from './trust-level.types';

@Injectable()
export class TrustLevelService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes trust level on-the-fly from live signals (no persistence).
   * v1 rules:
   *   EXPLORER   : default
   *   VERIFIED   : kycStatus === VERIFIED
   *   TRUSTED    : VERIFIED + score >= 70 + >= 3 deliveries as carrier
   *   HIGH_TRUST : TRUSTED + score >= 85 + >= 10 deliveries + 0 active fraud flags
   */
  async computeTrustLevel(userId: string): Promise<TrustLevelResult> {
    const signals: string[] = [];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
      },
    });

    if (!user) {
      return {
        level: TrustLevel.EXPLORER,
        score: 0,
        signals: [],
        computationVersion: 'v1',
      };
    }

    const trustProfile = await this.prisma.userTrustProfile
      .findUnique({
        where: { userId },
        select: { score: true },
      })
      .catch(() => null);

    const score = trustProfile?.score ?? 0;

    const deliveredCount = await this.prisma.transaction
      .count({
        where: {
          status: TransactionStatus.DELIVERED,
          trip: {
            carrierId: userId,
          },
        },
      })
      .catch(() => 0);

    const activeFraudFlags = await this.prisma.fraudFlag
      .count({
        where: {
          userId,
          resolvedAt: null,
        },
      })
      .catch(() => 0);

    const kycVerified = user.kycStatus === KycStatus.VERIFIED;
    if (kycVerified) signals.push('KYC_VERIFIED');
    if (score >= 70) signals.push('SCORE_70');
    if (score >= 85) signals.push('SCORE_85');
    if (deliveredCount >= 3) signals.push(`${deliveredCount}_DELIVERIES`);
    if (deliveredCount >= 10) signals.push('10_DELIVERIES');
    // Only relevant as a HIGH_TRUST signal when the other conditions are met
    if (kycVerified && score >= 85 && deliveredCount >= 10 && activeFraudFlags === 0) {
      signals.push('NO_FRAUD_FLAGS');
    }

    let level = TrustLevel.EXPLORER;

    if (kycVerified) {
      level = TrustLevel.VERIFIED;

      if (score >= 70 && deliveredCount >= 3) {
        level = TrustLevel.TRUSTED;

        if (score >= 85 && deliveredCount >= 10 && activeFraudFlags === 0) {
          level = TrustLevel.HIGH_TRUST;
        }
      }
    }

    return {
      level,
      score,
      signals,
      computationVersion: 'v1',
    };
  }
}
