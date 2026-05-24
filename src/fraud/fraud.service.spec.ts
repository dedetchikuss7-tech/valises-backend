import { Test, TestingModule } from '@nestjs/testing';
import { FraudService } from './fraud.service';
import { PrismaService } from '../prisma/prisma.service';

const makePrisma = () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  transaction: { count: jest.fn() },
  payout: {
    findFirst: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  trip: { findMany: jest.fn() },
  fraudFlag: { create: jest.fn().mockResolvedValue({}) },
});

describe('FraudService — Anti-Fraude V2', () => {
  let service: FraudService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<FraudService>(FraudService);
  });

  // ── checkMultiAccount ──────────────────────────────────────────────────────

  it('1. checkMultiAccount — { blocked: false } si aucun compte similaire', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'alice@example.com' });
    prisma.user.findMany.mockResolvedValue([]);

    const result = await service.checkMultiAccount('user-1');

    expect(result).toEqual({ blocked: false });
  });

  it('2. checkMultiAccount — flagged si >= 2 comptes similaires', async () => {
    const id2 = 'user-2';
    const id3 = 'user-3';
    prisma.user.findUnique.mockResolvedValue({ email: 'john.doe+test@gmail.com' });
    prisma.user.findMany.mockResolvedValue([
      { id: id2, email: 'johndoe@gmail.com', createdAt: new Date() },
      { id: id3, email: 'john.doe@gmail.com', createdAt: new Date() },
    ]);

    const result = await service.checkMultiAccount('user-1');

    expect(result.blocked).toBe(false);
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('MULTI_ACCOUNT_DETECTED');
    expect(result.relatedUserIds).toEqual([id2, id3]);
  });

  it('3. checkMultiAccount — blocked reste false même en cas de fraude', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'test@gmail.com' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'u2', email: 'test@gmail.com', createdAt: new Date() },
      { id: 'u3', email: 'test@gmail.com', createdAt: new Date() },
    ]);

    const result = await service.checkMultiAccount('user-1');

    expect(result.blocked).toBe(false);
    expect(result.flagged).toBe(true);
  });

  // ── checkImpossibleTravel ──────────────────────────────────────────────────

  it('4. checkImpossibleTravel — { blocked: false } si pas de trip récent', async () => {
    prisma.trip.findMany.mockResolvedValue([]);

    const result = await service.checkImpossibleTravel('user-1', 'Paris', 'Douala');

    expect(result).toEqual({ blocked: false });
  });

  it('5. checkImpossibleTravel — flagged si dernier corridor != cityFrom ET < 2h', async () => {
    prisma.trip.findMany.mockResolvedValue([
      {
        corridor: { name: 'Douala' },
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      },
    ]);

    const result = await service.checkImpossibleTravel('user-1', 'Paris', 'Lyon');

    expect(result.blocked).toBe(false);
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('IMPOSSIBLE_TRAVEL_DETECTED');
  });

  it('5b. checkImpossibleTravel — { blocked: false } si corridor == cityFrom (cohérent)', async () => {
    prisma.trip.findMany.mockResolvedValue([
      {
        corridor: { name: 'Paris' },
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      },
    ]);

    const result = await service.checkImpossibleTravel('user-1', 'Paris', 'Douala');

    expect(result).toEqual({ blocked: false });
  });

  // ── checkPayoutFarmingV2 ───────────────────────────────────────────────────

  it('6. checkPayoutFarmingV2 — { blocked: false } si payouts < 15 et montant < 500000', async () => {
    prisma.payout.count.mockResolvedValue(5);
    prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });

    const result = await service.checkPayoutFarmingV2('user-1');

    expect(result).toEqual({ blocked: false });
  });

  it('7. checkPayoutFarmingV2 — flagged si count > 15', async () => {
    prisma.payout.count.mockResolvedValue(20);
    prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 50000 } });

    const result = await service.checkPayoutFarmingV2('user-1');

    expect(result.blocked).toBe(false);
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('PAYOUT_FARMING_DETECTED');
    expect((result.metadata as any)?.count).toBe(20);
  });

  it('8. checkPayoutFarmingV2 — flagged si totalAmount > 500000', async () => {
    prisma.payout.count.mockResolvedValue(10);
    prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 750000 } });

    const result = await service.checkPayoutFarmingV2('user-1');

    expect(result.blocked).toBe(false);
    expect(result.flagged).toBe(true);
    expect((result.metadata as any)?.totalAmount).toBe(750000);
  });

  // ── runFullFraudCheck ──────────────────────────────────────────────────────

  it('9. runFullFraudCheck — blocked: true si velocity check déclenche', async () => {
    // velocity: > 5 transactions
    prisma.transaction.count.mockResolvedValue(6);
    // payout cooldown: pas de payout récent
    prisma.payout.findFirst.mockResolvedValue(null);
    // multi account: user introuvable
    prisma.user.findUnique.mockResolvedValue(null);
    // payout farming V2: rien
    prisma.payout.count.mockResolvedValue(0);
    prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    const report = await service.runFullFraudCheck('user-1');

    expect(report.blocked).toBe(true);
    expect(report.blockReason).toBe('FRAUD_VELOCITY_LIMIT');
    expect(report.userId).toBe('user-1');
    expect(report.flags).toHaveLength(4);
    expect(typeof report.checkedAt).toBe('string');
  });

  it('10. runFullFraudCheck — rapport complet avec les 4 checks', async () => {
    prisma.transaction.count.mockResolvedValue(1);
    prisma.payout.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ email: 'ok@example.com' });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.payout.count.mockResolvedValue(2);
    prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });

    const report = await service.runFullFraudCheck('user-1');

    expect(report.blocked).toBe(false);
    expect(report.blockReason).toBeNull();
    expect(report.flags).toHaveLength(4);
    expect(report.flagCount).toBe(0);
    expect(report.userId).toBe('user-1');
  });
});
