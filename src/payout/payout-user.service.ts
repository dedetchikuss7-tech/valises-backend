import { Injectable, NotFoundException } from '@nestjs/common';
import { PayoutStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutHistoryQueryDto } from './dto/payout-history-query.dto';

@Injectable()
export class PayoutUserService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyHistory(userId: string, query: PayoutHistoryQueryDto) {
    const limit = Math.min(query.limit ?? 20, 50);

    const payouts = await this.prisma.payout.findMany({
      where: {
        transaction: { travelerId: userId },
      },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        eligibleAt: true,
        autoEligible: true,
        createdAt: true,
        transaction: {
          select: {
            id: true,
            escrowAmount: true,
          },
        },
      },
    });

    const hasMore = payouts.length > limit;
    const data = hasMore ? payouts.slice(0, limit) : payouts;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return { data, nextCursor, hasMore };
  }

  async getPayoutById(payoutId: string, userId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        eligibleAt: true,
        autoEligible: true,
        autoApprovedAt: true,
        createdAt: true,
        transaction: {
          select: {
            id: true,
            travelerId: true,
            senderId: true,
            escrowAmount: true,
          },
        },
      },
    });

    if (!payout) throw new NotFoundException(`Payout ${payoutId} not found`);

    if (payout.transaction.travelerId !== userId) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    return payout;
  }

  async getNextEligible(userId: string) {
    const nextPayout = await this.prisma.payout.findFirst({
      where: {
        transaction: { travelerId: userId },
        status: PayoutStatus.READY,
        eligibleAt: { not: null },
      },
      orderBy: { eligibleAt: 'asc' },
      select: {
        id: true,
        status: true,
        eligibleAt: true,
        transaction: {
          select: { id: true },
        },
      },
    });

    if (!nextPayout) {
      return { nextEligible: null };
    }

    return {
      nextEligible: {
        payoutId: nextPayout.id,
        transactionId: nextPayout.transaction.id,
        eligibleAt: nextPayout.eligibleAt,
        status: nextPayout.status,
      },
    };
  }
}
