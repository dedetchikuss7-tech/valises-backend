import { Test, TestingModule } from '@nestjs/testing';
import { PayoutAutoService } from './payout-auto.service';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutService } from './payout.service';

describe('PayoutAutoService', () => {
  let service: PayoutAutoService;
  let prisma: any;
  let payoutService: any;

  const mockPayout = {
    id: 'p1',
    status: 'READY',
    autoEligible: false,
    autoApprovedAt: null,
    transaction: {
      id: 't1',
      amount: 5000,
      deliveryConfirmedAt: new Date(Date.now() - 50 * 3600 * 1000),
      status: 'DELIVERED',
      travelerId: 'u1',
    },
  };

  beforeEach(async () => {
    prisma = {
      payout: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userTrustProfile: {
        findUnique: jest.fn(),
      },
      fraudFlag: {
        count: jest.fn(),
      },
    };

    payoutService = {
      approvePayout: jest.fn().mockResolvedValue({ status: 'REQUESTED' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutAutoService,
        { provide: PrismaService, useValue: prisma },
        { provide: PayoutService, useValue: payoutService },
      ],
    }).compile();

    service = module.get<PayoutAutoService>(PayoutAutoService);
  });

  describe('isUserEligibleForAuto', () => {
    it('returns true for trusted user with no fraud flags', async () => {
      prisma.userTrustProfile.findUnique.mockResolvedValue({ score: 90 });
      prisma.fraudFlag.count.mockResolvedValue(0);
      expect(await service.isUserEligibleForAuto('u1')).toBe(true);
    });

    it('returns false if trustScore below threshold', async () => {
      prisma.userTrustProfile.findUnique.mockResolvedValue({ score: 70 });
      expect(await service.isUserEligibleForAuto('u1')).toBe(false);
    });

    it('returns false if active fraud flags exist', async () => {
      prisma.userTrustProfile.findUnique.mockResolvedValue({ score: 90 });
      prisma.fraudFlag.count.mockResolvedValue(2);
      expect(await service.isUserEligibleForAuto('u1')).toBe(false);
    });

    it('returns false if user not found', async () => {
      prisma.userTrustProfile.findUnique.mockResolvedValue(null);
      expect(await service.isUserEligibleForAuto('u1')).toBe(false);
    });

    it('returns false if trustScore is exactly 84', async () => {
      prisma.userTrustProfile.findUnique.mockResolvedValue({ score: 84 });
      expect(await service.isUserEligibleForAuto('u1')).toBe(false);
    });

    it('returns true if trustScore is exactly 85', async () => {
      prisma.userTrustProfile.findUnique.mockResolvedValue({ score: 85 });
      prisma.fraudFlag.count.mockResolvedValue(0);
      expect(await service.isUserEligibleForAuto('u1')).toBe(true);
    });
  });

  describe('markEligibleBatch', () => {
    it('marks eligible payouts and skips ineligible ones', async () => {
      prisma.payout.findMany.mockResolvedValue([mockPayout]);
      prisma.userTrustProfile.findUnique.mockResolvedValue({ score: 90 });
      prisma.fraudFlag.count.mockResolvedValue(0);
      prisma.payout.update.mockResolvedValue({});

      const result = await service.markEligibleBatch();

      expect(result.marked).toBe(1);
      expect(result.skipped).toBe(0);
      expect(prisma.payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: expect.objectContaining({ autoEligible: true }),
        }),
      );
    });

    it('skips payout if user trustScore too low', async () => {
      prisma.payout.findMany.mockResolvedValue([mockPayout]);
      prisma.userTrustProfile.findUnique.mockResolvedValue({ score: 60 });

      const result = await service.markEligibleBatch();

      expect(result.marked).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('returns zero when no candidates', async () => {
      prisma.payout.findMany.mockResolvedValue([]);
      const result = await service.markEligibleBatch();
      expect(result.marked).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe('approveEligible', () => {
    it('approves eligible payout and calls approvePayout', async () => {
      prisma.payout.findUnique.mockResolvedValue({
        ...mockPayout,
        autoEligible: true,
      });
      prisma.userTrustProfile.findUnique.mockResolvedValue({ score: 90 });
      prisma.fraudFlag.count.mockResolvedValue(0);
      prisma.payout.update.mockResolvedValue({});

      const result = await service.approveEligible(['p1'], 'admin1');

      expect(result.approved).toBe(1);
      expect(result.failed).toHaveLength(0);
      expect(payoutService.approvePayout).toHaveBeenCalledWith('p1', 'admin1');
    });

    it('rejects payout that is no longer eligible at approval time', async () => {
      prisma.payout.findUnique.mockResolvedValue({
        ...mockPayout,
        autoEligible: true,
      });
      prisma.userTrustProfile.findUnique.mockResolvedValue({ score: 50 });
      prisma.payout.update.mockResolvedValue({});

      const result = await service.approveEligible(['p1'], 'admin1');

      expect(result.approved).toBe(0);
      expect(result.failed).toContain('p1');
      expect(payoutService.approvePayout).not.toHaveBeenCalled();
    });

    it('rejects payout with wrong status', async () => {
      prisma.payout.findUnique.mockResolvedValue({
        ...mockPayout,
        status: 'PAID',
        autoEligible: true,
      });

      const result = await service.approveEligible(['p1'], 'admin1');
      expect(result.failed).toContain('p1');
    });

    it('rejects non-existent payout', async () => {
      prisma.payout.findUnique.mockResolvedValue(null);
      const result = await service.approveEligible(['ghost'], 'admin1');
      expect(result.failed).toContain('ghost');
    });

    it('handles partial batch — approves valid, rejects invalid', async () => {
      prisma.payout.findUnique
        .mockResolvedValueOnce({
          id: 'p1',
          status: 'READY',
          autoEligible: true,
          transaction: { travelerId: 'u1' },
        })
        .mockResolvedValueOnce(null);
      prisma.userTrustProfile.findUnique.mockResolvedValue({ score: 90 });
      prisma.fraudFlag.count.mockResolvedValue(0);
      prisma.payout.update.mockResolvedValue({});

      const result = await service.approveEligible(['p1', 'ghost'], 'admin1');

      expect(result.approved).toBe(1);
      expect(result.failed).toContain('ghost');
    });
  });

  describe('getEligibleQueue', () => {
    it('returns auto-eligible pending payouts ordered by eligibleAt', async () => {
      prisma.payout.findMany.mockResolvedValue([mockPayout]);
      const queue = await service.getEligibleQueue();
      expect(queue).toHaveLength(1);
      expect(prisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ autoEligible: true }),
        }),
      );
    });
  });
});
