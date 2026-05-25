import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutService } from './payout.service';

const COOLDOWN_HOURS = 48;
const TRUSTED_SCORE_MIN = 85;
const AUTO_BATCH_LIMIT = 50;

@Injectable()
export class PayoutAutoService {
  private readonly logger = new Logger(PayoutAutoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payoutService: PayoutService,
  ) {}

  async markEligibleBatch(): Promise<{ marked: number; skipped: number }> {
    const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);

    const candidates = await this.prisma.payout.findMany({
      where: {
        status: 'READY',
        autoEligible: false,
        transaction: {
          deliveryConfirmedAt: { lte: cutoff },
          status: 'DELIVERED',
        },
      },
      include: {
        transaction: true,
      },
      take: AUTO_BATCH_LIMIT,
    });

    let marked = 0;
    let skipped = 0;

    for (const payout of candidates) {
      const travelerId = payout.transaction.travelerId;
      const eligible = await this.isUserEligibleForAuto(travelerId);
      if (!eligible) {
        skipped++;
        continue;
      }

      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          autoEligible: true,
          eligibleAt: new Date(),
        },
      });
      marked++;
    }

    this.logger.log(`Payout auto batch: ${marked} marked eligible, ${skipped} skipped`);
    return { marked, skipped };
  }

  async isUserEligibleForAuto(userId: string): Promise<boolean> {
    const profile = await this.prisma.userTrustProfile.findUnique({
      where: { userId },
      select: { score: true },
    });

    if (!profile || profile.score < TRUSTED_SCORE_MIN) return false;

    const activeFraudFlags = await this.prisma.fraudFlag.count({
      where: { userId, resolvedAt: null },
    });

    return activeFraudFlags === 0;
  }

  async getEligibleQueue(): Promise<any[]> {
    return this.prisma.payout.findMany({
      where: {
        status: 'READY',
        autoEligible: true,
        autoApprovedAt: null,
      },
      include: {
        transaction: {
          select: {
            id: true,
            amount: true,
            deliveryConfirmedAt: true,
            traveler: { select: { id: true, email: true } },
          },
        },
      },
      orderBy: { eligibleAt: 'asc' },
    });
  }

  async approveEligible(
    payoutIds: string[],
    adminId: string,
  ): Promise<{ approved: number; failed: string[] }> {
    let approved = 0;
    const failed: string[] = [];

    for (const payoutId of payoutIds) {
      try {
        const payout = await this.prisma.payout.findUnique({
          where: { id: payoutId },
          include: { transaction: true },
        });

        if (!payout || !payout.autoEligible || payout.status !== 'READY') {
          failed.push(payoutId);
          continue;
        }

        const travelerId = payout.transaction.travelerId;
        const stillEligible = await this.isUserEligibleForAuto(travelerId);
        if (!stillEligible) {
          await this.prisma.payout.update({
            where: { id: payoutId },
            data: { autoEligible: false },
          });
          failed.push(payoutId);
          continue;
        }

        await this.prisma.payout.update({
          where: { id: payoutId },
          data: {
            autoApprovedAt: new Date(),
            autoApprovedBy: adminId,
          },
        });

        await this.payoutService.approvePayout(payoutId, adminId);
        approved++;
      } catch (err) {
        this.logger.error(`Failed to approve payout ${payoutId}`, err);
        failed.push(payoutId);
      }
    }

    return { approved, failed };
  }
}
