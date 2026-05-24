import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ProviderEventProcessingStatus, TransactionStatus, PayoutStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_QUEUE, WEBHOOK_QUEUE } from '../queue/queue.module';

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface Alert {
  level: 'WARNING' | 'CRITICAL';
  domain: string;
  message: string;
  count: number;
}

export interface OperationalHealthSnapshot {
  generatedAt: string;
  transactions: {
    stuckCount: number;
    pendingPaymentCount: number;
    inTransitCount: number;
  };
  payouts: {
    pendingCount: number;
    failedCount: number;
  };
  notifications: {
    failedOutboxCount: number;
    pendingOutboxCount: number;
  };
  webhooks: {
    recentFailedCount: number;
  };
  queues: {
    webhook: QueueStats | null;
    notification: QueueStats | null;
  };
  alerts: Alert[];
}

type MetricsCore = Omit<OperationalHealthSnapshot, 'generatedAt' | 'alerts'>;

@Injectable()
export class OperationalHealthService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  async getHealthSnapshot(): Promise<OperationalHealthSnapshot> {
    const now = Date.now();
    const h48ago = new Date(now - 48 * 60 * 60 * 1000);
    const h24ago = new Date(now - 24 * 60 * 60 * 1000);
    const h1ago = new Date(now - 60 * 60 * 1000);
    const d7ago = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      stuckCount,
      pendingPaymentCount,
      inTransitCount,
      payoutsPendingCount,
      payoutsFailedCount,
      failedOutboxResult,
      pendingOutboxResult,
      recentFailedCount,
      webhookStats,
      notificationStats,
    ] = await Promise.all([
      // PAID transactions with no payout created >48h ago
      this.prisma.transaction.count({
        where: {
          status: TransactionStatus.PAID,
          payout: { is: null },
          updatedAt: { lt: h48ago },
        },
      }),
      // Transactions waiting for payment (CREATED) >24h
      this.prisma.transaction.count({
        where: {
          status: TransactionStatus.CREATED,
          updatedAt: { lt: h24ago },
        },
      }),
      // Transactions IN_TRANSIT for >7 days
      this.prisma.transaction.count({
        where: {
          status: TransactionStatus.IN_TRANSIT,
          updatedAt: { lt: d7ago },
        },
      }),
      // Payouts in active pending states >48h (REQUESTED or PROCESSING)
      this.prisma.payout.count({
        where: {
          status: { in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] },
          createdAt: { lt: h48ago },
        },
      }),
      this.prisma.payout.count({
        where: { status: PayoutStatus.FAILED },
      }),
      // notification_outbox is a raw SQL table (no Prisma model)
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM notification_outbox WHERE status = 'FAILED'
      `,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM notification_outbox WHERE status = 'PENDING' AND created_at < ${h1ago}
      `,
      this.prisma.providerEvent.count({
        where: {
          processingStatus: ProviderEventProcessingStatus.FAILED,
          createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
        },
      }),
      this.safeGetQueueStats(this.webhookQueue),
      this.safeGetQueueStats(this.notificationQueue),
    ]);

    const metrics: MetricsCore = {
      transactions: {
        stuckCount,
        pendingPaymentCount,
        inTransitCount,
      },
      payouts: {
        pendingCount: payoutsPendingCount,
        failedCount: payoutsFailedCount,
      },
      notifications: {
        failedOutboxCount: Number(failedOutboxResult[0]?.count ?? 0),
        pendingOutboxCount: Number(pendingOutboxResult[0]?.count ?? 0),
      },
      webhooks: {
        recentFailedCount,
      },
      queues: {
        webhook: webhookStats,
        notification: notificationStats,
      },
    };

    return {
      generatedAt: new Date().toISOString(),
      ...metrics,
      alerts: this.buildAlerts(metrics),
    };
  }

  private buildAlerts(metrics: MetricsCore): Alert[] {
    const alerts: Alert[] = [];

    if (metrics.transactions.stuckCount > 0) {
      alerts.push({
        level: 'CRITICAL',
        domain: 'transactions',
        message: `${metrics.transactions.stuckCount} transactions PAID sans payout depuis >48h`,
        count: metrics.transactions.stuckCount,
      });
    }

    if (metrics.transactions.pendingPaymentCount > 5) {
      alerts.push({
        level: 'WARNING',
        domain: 'transactions',
        message: `${metrics.transactions.pendingPaymentCount} transactions en attente de paiement depuis >24h`,
        count: metrics.transactions.pendingPaymentCount,
      });
    }

    if (metrics.payouts.pendingCount > 10) {
      alerts.push({
        level: 'WARNING',
        domain: 'payouts',
        message: `${metrics.payouts.pendingCount} payouts pending depuis >48h`,
        count: metrics.payouts.pendingCount,
      });
    }

    if (metrics.payouts.failedCount > 0) {
      alerts.push({
        level: 'CRITICAL',
        domain: 'payouts',
        message: `${metrics.payouts.failedCount} payouts FAILED non résolus`,
        count: metrics.payouts.failedCount,
      });
    }

    if (metrics.notifications.failedOutboxCount > 0) {
      alerts.push({
        level: 'WARNING',
        domain: 'notifications',
        message: `${metrics.notifications.failedOutboxCount} notifications FAILED dans l'outbox`,
        count: metrics.notifications.failedOutboxCount,
      });
    }

    if (metrics.queues.webhook !== null && metrics.queues.webhook.failed > 5) {
      alerts.push({
        level: 'CRITICAL',
        domain: 'queues',
        message: `${metrics.queues.webhook.failed} webhook jobs en DLQ`,
        count: metrics.queues.webhook.failed,
      });
    }

    if (metrics.queues.notification !== null && metrics.queues.notification.failed > 10) {
      alerts.push({
        level: 'WARNING',
        domain: 'queues',
        message: `${metrics.queues.notification.failed} notification jobs en DLQ`,
        count: metrics.queues.notification.failed,
      });
    }

    return alerts;
  }

  private async safeGetQueueStats(queue: Queue): Promise<QueueStats | null> {
    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      return {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
      };
    } catch {
      return null;
    }
  }
}
