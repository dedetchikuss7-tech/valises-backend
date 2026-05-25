import { Test, TestingModule } from '@nestjs/testing';
import { TrustLevelService } from './trust-level.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrustLevel } from './trust-level.types';

describe('TrustLevelService', () => {
  let service: TrustLevelService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      userTrustProfile: { findUnique: jest.fn() },
      transaction: { count: jest.fn() },
      fraudFlag: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrustLevelService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TrustLevelService>(TrustLevelService);
  });

  const setupMocks = (opts: {
    kycStatus?: string;
    score?: number;
    deliveries?: number;
    fraudFlags?: number;
  }) => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      kycStatus: opts.kycStatus ?? 'PENDING',
    });
    prisma.userTrustProfile.findUnique.mockResolvedValue({
      score: opts.score ?? 0,
    });
    prisma.transaction.count.mockResolvedValue(opts.deliveries ?? 0);
    prisma.fraudFlag.count.mockResolvedValue(opts.fraudFlags ?? 0);
  };

  it('returns EXPLORER for new user with no KYC', async () => {
    setupMocks({ kycStatus: 'PENDING' });
    const result = await service.computeTrustLevel('u1');
    expect(result.level).toBe(TrustLevel.EXPLORER);
    expect(result.computationVersion).toBe('v1');
  });

  it('returns VERIFIED for KYC verified user with low score', async () => {
    setupMocks({ kycStatus: 'VERIFIED', score: 30, deliveries: 0 });
    const result = await service.computeTrustLevel('u1');
    expect(result.level).toBe(TrustLevel.VERIFIED);
    expect(result.signals).toContain('KYC_VERIFIED');
  });

  it('returns TRUSTED for KYC + score>=70 + >=3 deliveries', async () => {
    setupMocks({ kycStatus: 'VERIFIED', score: 75, deliveries: 5 });
    const result = await service.computeTrustLevel('u1');
    expect(result.level).toBe(TrustLevel.TRUSTED);
    expect(result.signals).toContain('SCORE_70');
  });

  it('returns VERIFIED (not TRUSTED) if score>=70 but deliveries<3', async () => {
    setupMocks({ kycStatus: 'VERIFIED', score: 72, deliveries: 2 });
    const result = await service.computeTrustLevel('u1');
    expect(result.level).toBe(TrustLevel.VERIFIED);
  });

  it('returns VERIFIED (not TRUSTED) if deliveries>=3 but score<70', async () => {
    setupMocks({ kycStatus: 'VERIFIED', score: 65, deliveries: 5 });
    const result = await service.computeTrustLevel('u1');
    expect(result.level).toBe(TrustLevel.VERIFIED);
  });

  it('returns HIGH_TRUST for score>=85 + >=10 deliveries + 0 fraud flags', async () => {
    setupMocks({ kycStatus: 'VERIFIED', score: 90, deliveries: 12, fraudFlags: 0 });
    const result = await service.computeTrustLevel('u1');
    expect(result.level).toBe(TrustLevel.HIGH_TRUST);
    expect(result.signals).toContain('NO_FRAUD_FLAGS');
    expect(result.signals).toContain('10_DELIVERIES');
  });

  it('returns TRUSTED (not HIGH_TRUST) if score>=85 + >=10 but has fraud flags', async () => {
    setupMocks({ kycStatus: 'VERIFIED', score: 88, deliveries: 10, fraudFlags: 1 });
    const result = await service.computeTrustLevel('u1');
    expect(result.level).toBe(TrustLevel.TRUSTED);
  });

  it('returns TRUSTED (not HIGH_TRUST) if score>=85 + 0 fraud flags but deliveries<10', async () => {
    setupMocks({ kycStatus: 'VERIFIED', score: 87, deliveries: 7, fraudFlags: 0 });
    const result = await service.computeTrustLevel('u1');
    expect(result.level).toBe(TrustLevel.TRUSTED);
  });

  it('returns EXPLORER for unknown user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await service.computeTrustLevel('ghost');
    expect(result.level).toBe(TrustLevel.EXPLORER);
    expect(result.score).toBe(0);
  });

  it('always includes computationVersion v1', async () => {
    setupMocks({});
    const result = await service.computeTrustLevel('u1');
    expect(result.computationVersion).toBe('v1');
  });

  it('signals array is empty for EXPLORER', async () => {
    setupMocks({ kycStatus: 'PENDING', score: 0 });
    const result = await service.computeTrustLevel('u1');
    expect(result.signals).toHaveLength(0);
  });

  it('score boundary — exactly 70 qualifies for TRUSTED', async () => {
    setupMocks({ kycStatus: 'VERIFIED', score: 70, deliveries: 3 });
    const result = await service.computeTrustLevel('u1');
    expect(result.level).toBe(TrustLevel.TRUSTED);
  });

  it('score boundary — exactly 85 qualifies for HIGH_TRUST', async () => {
    setupMocks({ kycStatus: 'VERIFIED', score: 85, deliveries: 10, fraudFlags: 0 });
    const result = await service.computeTrustLevel('u1');
    expect(result.level).toBe(TrustLevel.HIGH_TRUST);
  });
});
