import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { DisputeStatus, PayoutStatus, ProviderEventProcessingStatus, TransactionStatus } from '@prisma/client';
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

export interface ConnectivityCheck {
  status: 'OK' | 'WARN';
  message: string;
}

export interface QueueDepthCheck extends ConnectivityCheck {
  counts?: Record<string, number>;
}

export interface OperationalHealthSnapshot {
  generatedAt: string;
  connectivity: {
    redis: ConnectivityCheck;
    notificationOutbox: ConnectivityCheck;
    queueDepth: QueueDepthCheck;
  };
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
      redisCheck,
      notificationOutboxCheck,
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
      this.checkRedis(),
      this.checkNotificationOutbox(),
    ]);

    const queueDepthCheck = this.buildQueueDepthCheck(webhookStats, notificationStats);

    const metrics: MetricsCore = {
      connectivity: {
        redis: redisCheck,
        notificationOutbox: notificationOutboxCheck,
        queueDepth: queueDepthCheck,
      },
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

  async getMetrics() {
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      transactionsLast24h,
      payoutsPending,
      disputesOpen,
      fraudFlagsActive,
    ] = await Promise.all([
      this.prisma.transaction.count({ where: { createdAt: { gte: h24 } } }),
      this.prisma.payout.count({
        where: { status: { in: [PayoutStatus.READY, PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] } },
      }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      this.prisma.fraudFlag.count({ where: { resolvedAt: null } }),
    ]);

    return {
      computedAt: now.toISOString(),
      windows: {
        last24h: { transactions: transactionsLast24h },
        current: {
          payoutsPending,
          disputesOpen,
          fraudFlagsActive,
        },
      },
    };
  }

  private async checkRedis(): Promise<ConnectivityCheck> {
    try {
      const client = await this.webhookQueue.client;
      await (client as any).ping();
      return { status: 'OK', message: 'Redis reachable' };
    } catch (e) {
      return { status: 'WARN', message: `Redis unavailable: ${(e as Error).message}` };
    }
  }

  private buildQueueDepthCheck(
    webhookStats: QueueStats | null,
    notificationStats: QueueStats | null,
  ): QueueDepthCheck {
    const counts: Record<string, number> = {
      webhookFailed: webhookStats?.failed ?? 0,
      webhookWaiting: webhookStats?.waiting ?? 0,
      notificationFailed: notificationStats?.failed ?? 0,
      notificationWaiting: notificationStats?.waiting ?? 0,
    };

    const exceeded =
      counts.webhookFailed > 50 ||
      counts.notificationFailed > 50 ||
      counts.webhookWaiting > 500 ||
      counts.notificationWaiting > 500;

    if (exceeded) {
      return { status: 'WARN', message: 'Queue depth threshold exceeded', counts };
    }

    return { status: 'OK', message: 'Queue depths normal', counts };
  }

  private async checkNotificationOutbox(): Promise<ConnectivityCheck> {
    try {
      const result = await this.prisma.$queryRaw<{ last_sent: Date | null }[]>`
        SELECT MAX(sent_at) as last_sent
        FROM notification_outbox
        WHERE attempt_count > 0
      `;
      const last = result[0]?.last_sent;
      if (!last) return { status: 'WARN', message: 'No notifications processed yet' };
      const ageMinutes = (Date.now() - last.getTime()) / 60000;
      if (ageMinutes > 60) {
        return { status: 'WARN', message: `Last notification processed ${Math.round(ageMinutes)}min ago` };
      }
      return { status: 'OK', message: `Last notification processed ${Math.round(ageMinutes)}min ago` };
    } catch {
      return { status: 'WARN', message: 'Could not read notification outbox' };
    }
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
