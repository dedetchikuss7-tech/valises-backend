import { Test, TestingModule } from '@nestjs/testing';
import { ReferralRewardService } from './referral-reward.service';
import { PrismaService } from '../prisma/prisma.service';

const makeTxClient = (overrides: Record<string, any> = {}) => ({
  referralUse: { update: jest.fn() },
  ledgerEntry: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
  },
  ...overrides,
});

const mockPrisma = {
  referralUse: {
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ReferralRewardService', () => {
  let service: ReferralRewardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralRewardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReferralRewardService>(ReferralRewardService);
    jest.clearAllMocks();
  });

  it('skips when user has no referral', async () => {
    mockPrisma.referralUse.findUnique.mockResolvedValue(null);
    await service.maybeGrantReferralReward('u1', 'tx1');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips when reward already granted', async () => {
    mockPrisma.referralUse.findUnique.mockResolvedValue({
      id: 'ru1',
      rewardGranted: true,
      referralCode: { ownerId: 'r1' },
      referredUser: { kycStatus: 'VERIFIED' },
    });
    await service.maybeGrantReferralReward('u1', 'tx1');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips when referred user KYC is not VERIFIED', async () => {
    mockPrisma.referralUse.findUnique.mockResolvedValue({
      id: 'ru1',
      rewardGranted: false,
      referralCode: { ownerId: 'r1' },
      referredUser: { kycStatus: 'PENDING' },
    });
    await service.maybeGrantReferralReward('u1', 'tx1');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips when referrer has reached cap of 50 rewards', async () => {
    mockPrisma.referralUse.findUnique.mockResolvedValue({
      id: 'ru1',
      rewardGranted: false,
      referralCode: { ownerId: 'r1' },
      referredUser: { kycStatus: 'VERIFIED' },
    });
    mockPrisma.referralUse.count.mockResolvedValue(50);
    await service.maybeGrantReferralReward('u1', 'tx1');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('grants reward when all conditions met', async () => {
    mockPrisma.referralUse.findUnique.mockResolvedValue({
      id: 'ru1',
      rewardGranted: false,
      referralCode: { ownerId: 'r1' },
      referredUser: { kycStatus: 'VERIFIED' },
    });
    mockPrisma.referralUse.count.mockResolvedValue(5);

    const txClient = makeTxClient();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txClient));

    await service.maybeGrantReferralReward('u1', 'tx1');

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txClient.referralUse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ru1' },
        data: expect.objectContaining({ rewardGranted: true }),
      }),
    );
    expect(txClient.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'REFERRAL_REWARD',
          actorUserId: 'r1',
          idempotencyKey: 'referral:ru1',
        }),
      }),
    );
  });

  it('skips ledger creation if entry already exists (idempotency)', async () => {
    mockPrisma.referralUse.findUnique.mockResolvedValue({
      id: 'ru1',
      rewardGranted: false,
      referralCode: { ownerId: 'r1' },
      referredUser: { kycStatus: 'VERIFIED' },
    });
    mockPrisma.referralUse.count.mockResolvedValue(0);

    const txClient = makeTxClient({
      ledgerEntry: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing-entry' }),
        create: jest.fn(),
      },
    });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txClient));

    await service.maybeGrantReferralReward('u1', 'tx1');

    expect(txClient.ledgerEntry.create).not.toHaveBeenCalled();
  });
});
