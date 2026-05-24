import { OperationalHealthService } from './operational-health.service';

describe('OperationalHealthService', () => {
  let service: OperationalHealthService;

  const prismaMock = {
    transaction: { count: jest.fn() },
    payout: { count: jest.fn() },
    providerEvent: { count: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const makeQueueMock = (counts: Record<string, number> = {}) => ({
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
    }),
  });

  function setupZeroCounts() {
    prismaMock.transaction.count.mockResolvedValue(0);
    prismaMock.payout.count.mockResolvedValue(0);
    prismaMock.providerEvent.count.mockResolvedValue(0);
    prismaMock.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getHealthSnapshot() retourne un objet avec les bonnes clés', async () => {
    setupZeroCounts();
    service = new OperationalHealthService(
      prismaMock as any,
      makeQueueMock() as any,
      makeQueueMock() as any,
    );

    const result = await service.getHealthSnapshot();

    expect(result).toHaveProperty('generatedAt');
    expect(result).toHaveProperty('transactions');
    expect(result).toHaveProperty('payouts');
    expect(result).toHaveProperty('notifications');
    expect(result).toHaveProperty('webhooks');
    expect(result).toHaveProperty('queues');
    expect(result).toHaveProperty('alerts');
    expect(result.transactions).toHaveProperty('stuckCount');
    expect(result.transactions).toHaveProperty('pendingPaymentCount');
    expect(result.transactions).toHaveProperty('inTransitCount');
    expect(result.payouts).toHaveProperty('pendingCount');
    expect(result.payouts).toHaveProperty('failedCount');
    expect(result.notifications).toHaveProperty('failedOutboxCount');
    expect(result.notifications).toHaveProperty('pendingOutboxCount');
    expect(result.queues).toHaveProperty('webhook');
    expect(result.queues).toHaveProperty('notification');
    expect(Array.isArray(result.alerts)).toBe(true);
  });

  it('génère une alerte CRITICAL quand stuckCount > 0', async () => {
    // transaction.count: first call = stuckCount=2, others = 0
    prismaMock.transaction.count
      .mockResolvedValueOnce(2) // stuckCount
      .mockResolvedValue(0);
    prismaMock.payout.count.mockResolvedValue(0);
    prismaMock.providerEvent.count.mockResolvedValue(0);
    prismaMock.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);

    service = new OperationalHealthService(
      prismaMock as any,
      makeQueueMock() as any,
      makeQueueMock() as any,
    );

    const result = await service.getHealthSnapshot();

    const criticalAlerts = result.alerts.filter((a) => a.level === 'CRITICAL' && a.domain === 'transactions');
    expect(criticalAlerts).toHaveLength(1);
    expect(criticalAlerts[0].count).toBe(2);
  });

  it('génère une alerte CRITICAL quand payouts.failedCount > 0', async () => {
    prismaMock.transaction.count.mockResolvedValue(0);
    // payout.count: first call = pendingCount=0, second call = failedCount=3
    prismaMock.payout.count
      .mockResolvedValueOnce(0) // pendingCount
      .mockResolvedValueOnce(3); // failedCount
    prismaMock.providerEvent.count.mockResolvedValue(0);
    prismaMock.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);

    service = new OperationalHealthService(
      prismaMock as any,
      makeQueueMock() as any,
      makeQueueMock() as any,
    );

    const result = await service.getHealthSnapshot();

    const criticalAlerts = result.alerts.filter((a) => a.level === 'CRITICAL' && a.domain === 'payouts');
    expect(criticalAlerts).toHaveLength(1);
    expect(criticalAlerts[0].count).toBe(3);
  });

  it('alerts est vide quand tout est à zéro', async () => {
    setupZeroCounts();
    service = new OperationalHealthService(
      prismaMock as any,
      makeQueueMock() as any,
      makeQueueMock() as any,
    );

    const result = await service.getHealthSnapshot();

    expect(result.alerts).toHaveLength(0);
  });

  it('ne throw pas si Redis est indisponible — queues retourne null', async () => {
    setupZeroCounts();
    const brokenQueue = {
      getJobCounts: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
    };

    service = new OperationalHealthService(
      prismaMock as any,
      brokenQueue as any,
      brokenQueue as any,
    );

    const result = await service.getHealthSnapshot();

    expect(result.queues.webhook).toBeNull();
    expect(result.queues.notification).toBeNull();
    expect(result.alerts).toHaveLength(0);
  });
});
