import { Test, TestingModule } from '@nestjs/testing';
import { SenderSummaryService } from './sender-summary.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  transaction: {
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  dispute: {
    count: jest.fn(),
  },
};

describe('SenderSummaryService', () => {
  let service: SenderSummaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SenderSummaryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SenderSummaryService>(SenderSummaryService);
    jest.clearAllMocks();
  });

  it('returns correct active, delivered counts and total amount', async () => {
    mockPrisma.transaction.groupBy.mockResolvedValue([
      { status: 'CREATED', _count: { id: 2 } },
      { status: 'PAID', _count: { id: 1 } },
      { status: 'DELIVERED', _count: { id: 5 } },
      { status: 'CANCELLED', _count: { id: 1 } },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: 750000 },
    });
    mockPrisma.dispute.count.mockResolvedValue(1);

    const result = await service.getSenderSummary('u1');

    expect(result.active).toBe(3); // CREATED + PAID
    expect(result.delivered).toBe(5);
    expect(result.totalAmountDeliveredXaf).toBe(750000);
    expect(result.activeDisputes).toBe(1);
  });

  it('returns zeros when no transactions', async () => {
    mockPrisma.transaction.groupBy.mockResolvedValue([]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.dispute.count.mockResolvedValue(0);

    const result = await service.getSenderSummary('u1');
    expect(result.active).toBe(0);
    expect(result.delivered).toBe(0);
    expect(result.totalAmountDeliveredXaf).toBe(0);
    expect(result.activeDisputes).toBe(0);
  });

  it('excludes DISPUTED from active count', async () => {
    mockPrisma.transaction.groupBy.mockResolvedValue([
      { status: 'CREATED', _count: { id: 1 } },
      { status: 'DISPUTED', _count: { id: 2 } },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.dispute.count.mockResolvedValue(2);

    const result = await service.getSenderSummary('u1');
    expect(result.active).toBe(1); // DISPUTED is terminal, not counted as active
    expect(result.activeDisputes).toBe(2);
  });

  it('queries dispute count with notIn RESOLVED and REJECTED', async () => {
    mockPrisma.transaction.groupBy.mockResolvedValue([]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.dispute.count.mockResolvedValue(0);

    await service.getSenderSummary('u1');

    expect(mockPrisma.dispute.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: ['RESOLVED', 'REJECTED'] },
        }),
      }),
    );
  });
});
