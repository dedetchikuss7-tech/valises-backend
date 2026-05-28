import { Test, TestingModule } from '@nestjs/testing';
import { PayoutUserService } from './payout-user.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  payout: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};

const basePayout = {
  id: 'p1',
  status: 'READY',
  amount: 85000,
  currency: 'XAF',
  eligibleAt: new Date('2026-06-15'),
  autoEligible: true,
  autoApprovedAt: null,
  createdAt: new Date(),
  transaction: { id: 'tx1', travelerId: 'u1', senderId: 'u2', escrowAmount: 100000 },
};

describe('PayoutUserService', () => {
  let service: PayoutUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutUserService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PayoutUserService>(PayoutUserService);
    jest.clearAllMocks();
  });

  describe('getMyHistory', () => {
    it('returns paginated payouts for user', async () => {
      mockPrisma.payout.findMany.mockResolvedValue([basePayout]);
      const result = await service.getMyHistory('u1', { limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(mockPrisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transaction: { travelerId: 'u1' } },
        }),
      );
    });

    it('sets hasMore and nextCursor when page is full', async () => {
      const payouts = Array.from({ length: 21 }, (_, i) => ({
        ...basePayout,
        id: `p${i}`,
      }));
      mockPrisma.payout.findMany.mockResolvedValue(payouts);
      const result = await service.getMyHistory('u1', { limit: 20 });
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('p19');
      expect(result.data).toHaveLength(20);
    });

    it('caps limit at 50 even if query requests more', async () => {
      mockPrisma.payout.findMany.mockResolvedValue([]);
      await service.getMyHistory('u1', { limit: 999 });
      expect(mockPrisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51 }),
      );
    });

    it('uses cursor pagination when cursor is provided', async () => {
      mockPrisma.payout.findMany.mockResolvedValue([basePayout]);
      await service.getMyHistory('u1', { limit: 20, cursor: 'p0' });
      expect(mockPrisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 1, cursor: { id: 'p0' } }),
      );
    });
  });

  describe('getPayoutById', () => {
    it('returns payout for the owner', async () => {
      mockPrisma.payout.findUnique.mockResolvedValue(basePayout);
      const result = await service.getPayoutById('p1', 'u1');
      expect(result.id).toBe('p1');
    });

    it('throws NotFoundException for unknown payout', async () => {
      mockPrisma.payout.findUnique.mockResolvedValue(null);
      await expect(service.getPayoutById('bad', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for non-owner — no 403 leak', async () => {
      mockPrisma.payout.findUnique.mockResolvedValue(basePayout);
      await expect(service.getPayoutById('p1', 'stranger')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getNextEligible', () => {
    it('returns next eligible payout', async () => {
      mockPrisma.payout.findFirst.mockResolvedValue({
        id: 'p1',
        status: 'READY',
        eligibleAt: new Date('2026-06-15'),
        transaction: { id: 'tx1' },
      });

      const result = await service.getNextEligible('u1');
      expect(result.nextEligible?.payoutId).toBe('p1');
      expect(result.nextEligible?.transactionId).toBe('tx1');
      expect(result.nextEligible?.eligibleAt).toBeDefined();
    });

    it('returns null when no eligible payout exists', async () => {
      mockPrisma.payout.findFirst.mockResolvedValue(null);
      const result = await service.getNextEligible('u1');
      expect(result.nextEligible).toBeNull();
    });

    it('queries only READY payouts with eligibleAt set', async () => {
      mockPrisma.payout.findFirst.mockResolvedValue(null);
      await service.getNextEligible('u1');
      expect(mockPrisma.payout.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'READY',
            eligibleAt: { not: null },
          }),
        }),
      );
    });
  });
});
