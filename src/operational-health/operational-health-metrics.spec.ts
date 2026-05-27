import { OperationalHealthService } from './operational-health.service';

describe('OperationalHealthService — getMetrics', () => {
  let service: OperationalHealthService;

  const mockPrisma = {
    transaction: { count: jest.fn() },
    payout: { count: jest.fn() },
    dispute: { count: jest.fn() },
    fraudFlag: { count: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const makeQueueMock = () => ({
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }),
    client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
  });

  beforeEach(() => {
    mockPrisma.transaction.count.mockResolvedValue(12);
    mockPrisma.payout.count.mockResolvedValue(3);
    mockPrisma.dispute.count.mockResolvedValue(1);
    mockPrisma.fraudFlag.count.mockResolvedValue(5);
    service = new OperationalHealthService(
      mockPrisma as any,
      makeQueueMock() as any,
      makeQueueMock() as any,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('returns metrics with correct structure', async () => {
    const result = await service.getMetrics();
    expect(result.computedAt).toBeDefined();
    expect(result.windows.last24h.transactions).toBe(12);
    expect(result.windows.current.payoutsPending).toBe(3);
    expect(result.windows.current.disputesOpen).toBe(1);
    expect(result.windows.current.fraudFlagsActive).toBe(5);
  });

  it('computedAt is a valid ISO timestamp', async () => {
    const result = await service.getMetrics();
    expect(new Date(result.computedAt).getTime()).not.toBeNaN();
  });

  it('all count queries are called once', async () => {
    await service.getMetrics();
    expect(mockPrisma.transaction.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.payout.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.dispute.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.fraudFlag.count).toHaveBeenCalledTimes(1);
  });
});
