import { Injectable, Logger } from '@nestjs/common';
import { LedgerEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const REWARD_CAP_PER_REFERRER = 50;
const REFERRAL_REWARD_AMOUNT_XAF = 500000;

@Injectable()
export class ReferralRewardService {
  private readonly logger = new Logger(ReferralRewardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called after a transaction reaches DELIVERED status.
   * Grants a REFERRAL_REWARD ledger entry to the referrer if conditions are met.
   * Idempotent: safe to call multiple times for the same transaction.
   */
  async maybeGrantReferralReward(referredUserId: string, transactionId: string): Promise<void> {
    const referralUse = await this.prisma.referralUse.findUnique({
      where: { referredUserId },
      select: {
        id: true,
        rewardGranted: true,
        referralCode: {
          select: { ownerId: true },
        },
        referredUser: {
          select: { kycStatus: true },
        },
      },
    });

    if (!referralUse) return;
    if (referralUse.rewardGranted) return;

    if (referralUse.referredUser.kycStatus !== 'VERIFIED') {
      this.logger.debug(
        `Referral reward skipped: referredUser ${referredUserId} KYC not VERIFIED`,
      );
      return;
    }

    const referrerId = referralUse.referralCode.ownerId;

    const grantedCount = await this.prisma.referralUse.count({
      where: { referralCode: { ownerId: referrerId }, rewardGranted: true },
    });

    if (grantedCount >= REWARD_CAP_PER_REFERRER) {
      this.logger.warn(`Referral reward cap reached for referrer ${referrerId}`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.referralUse.update({
        where: { id: referralUse.id },
        data: {
          rewardGranted: true,
          rewardGrantedAt: new Date(),
        },
      });

      const idempotencyKey = `referral:${referralUse.id}`;

      const existing = await tx.ledgerEntry.findUnique({
        where: {
          transactionId_idempotencyKey: {
            transactionId,
            idempotencyKey,
          },
        },
      });

      if (!existing) {
        await tx.ledgerEntry.create({
          data: {
            transactionId,
            type: LedgerEntryType.REFERRAL_REWARD,
            amount: REFERRAL_REWARD_AMOUNT_XAF,
            idempotencyKey,
            actorUserId: referrerId,
            note: `Referral reward for user ${referredUserId} first DELIVERED transaction`,
          },
        });
      }
    });

    this.logger.log(
      `Referral reward granted: referrer=${referrerId} referredUser=${referredUserId} tx=${transactionId}`,
    );
  }
}
