import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SenderSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSenderSummary(userId: string) {
    const [statusCounts, totalAmountResult] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['status'],
        where: { senderId: userId },
        _count: { id: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          senderId: userId,
          status: 'DELIVERED',
        },
        _sum: { amount: true },
      }),
    ]);

    const countByStatus = Object.fromEntries(
      statusCounts.map((r) => [r.status, r._count.id]),
    );

    const terminalStatuses = ['DELIVERED', 'CANCELLED', 'DISPUTED'];
    const activeCount = statusCounts
      .filter((r) => !terminalStatuses.includes(r.status))
      .reduce((sum, r) => sum + r._count.id, 0);

    const deliveredCount = countByStatus['DELIVERED'] ?? 0;
    const totalAmountDeliveredXaf = totalAmountResult._sum.amount ?? 0;

    const activeDisputesCount = await this.prisma.dispute.count({
      where: {
        transaction: { senderId: userId },
        status: { notIn: ['RESOLVED', 'REJECTED'] },
      },
    });

    return {
      active: activeCount,
      delivered: deliveredCount,
      totalAmountDeliveredXaf,
      activeDisputes: activeDisputesCount,
    };
  }
}
