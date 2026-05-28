import { TransactionService } from './transaction.service';

const mockPrisma = {
  transaction: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  refund: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  dispute: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  corridorPricingPaymentConfig: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockLedger = {
  getEscrowBalance: jest.fn(),
  createEntry: jest.fn(),
  addEntryIdempotent: jest.fn(),
  listByTransaction: jest.fn(),
};

const mockAbandonment = {
  markAbandoned: jest.fn(),
  resolveActiveByReference: jest.fn(),
};

const mockPayoutService = {
  requestPayoutForTransaction: jest.fn(),
};

describe('TransactionService.listTransactionsForSender', () => {
  let service: TransactionService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.refund.findMany.mockResolvedValue([]);
    mockPrisma.dispute.findMany.mockResolvedValue([]);

    service = new TransactionService(
      mockPrisma as any,
      mockLedger as any,
      mockAbandonment as any,
      mockPayoutService as any,
    );
  });

  it('includes canCancel=true for CREATED status', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        status: 'CREATED',
        amount: 50000,
        currency: 'XAF',
        deliveryConfirmedAt: null,
        createdAt: new Date(),
        corridor: { code: 'CMR-FR', name: 'Cameroun → France' },
      },
    ]);

    const result = await service.listTransactionsForSender('u1', { limit: 20 });
    expect(result.data[0].canCancel).toBe(true);
    expect(result.data[0].canOpenDispute).toBe(false);
  });

  it('includes canCancel=true for PAID status', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        status: 'PAID',
        amount: 50000,
        currency: 'XAF',
        deliveryConfirmedAt: null,
        createdAt: new Date(),
        corridor: { code: 'CMR-FR', name: 'Cameroun → France' },
      },
    ]);

    const result = await service.listTransactionsForSender('u1', { limit: 20 });
    expect(result.data[0].canCancel).toBe(true);
    expect(result.data[0].canOpenDispute).toBe(false);
  });

  it('includes canOpenDispute=true only when DELIVERED and deliveryConfirmedAt set', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx2',
        status: 'DELIVERED',
        amount: 50000,
        currency: 'XAF',
        deliveryConfirmedAt: new Date(),
        createdAt: new Date(),
        corridor: { code: 'CMR-FR', name: 'Cameroun → France' },
      },
    ]);

    const result = await service.listTransactionsForSender('u1', { limit: 20 });
    expect(result.data[0].canOpenDispute).toBe(true);
    expect(result.data[0].canCancel).toBe(false);
  });

  it('canOpenDispute=false when DELIVERED but deliveryConfirmedAt is null', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx3',
        status: 'DELIVERED',
        amount: 50000,
        currency: 'XAF',
        deliveryConfirmedAt: null,
        createdAt: new Date(),
        corridor: { code: 'CMR-FR', name: 'Cameroun → France' },
      },
    ]);

    const result = await service.listTransactionsForSender('u1', { limit: 20 });
    expect(result.data[0].canOpenDispute).toBe(false);
  });

  it('filters by status when provided', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    await service.listTransactionsForSender('u1', { limit: 20, status: 'PAID' });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { senderId: 'u1', status: 'PAID' },
      }),
    );
  });

  it('returns hasMore=true and nextCursor when more results exist', async () => {
    const txs = Array.from({ length: 21 }, (_, i) => ({
      id: `tx${i}`,
      status: 'CREATED',
      amount: 10000,
      currency: 'XAF',
      deliveryConfirmedAt: null,
      createdAt: new Date(),
      corridor: { code: 'CMR-FR', name: 'Cameroun → France' },
    }));
    mockPrisma.transaction.findMany.mockResolvedValue(txs);

    const result = await service.listTransactionsForSender('u1', { limit: 20 });
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('tx19');
    expect(result.data.length).toBe(20);
  });

  it('returns hasMore=false when results fit in one page', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        status: 'CREATED',
        amount: 10000,
        currency: 'XAF',
        deliveryConfirmedAt: null,
        createdAt: new Date(),
        corridor: null,
      },
    ]);

    const result = await service.listTransactionsForSender('u1', { limit: 20 });
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('caps limit at 50', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    await service.listTransactionsForSender('u1', { limit: 999 });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 51 }),
    );
  });
});
