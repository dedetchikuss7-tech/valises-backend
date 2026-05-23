import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReferralService } from './referral.service';

describe('ReferralService', () => {
  let service: ReferralService;

  const prismaMock = {
    referralCode: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    referralUse: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const baseCode = {
    id: 'rc1',
    ownerId: 'user1',
    code: 'ABCD1234',
    createdAt: new Date('2026-05-23T10:00:00Z'),
  };

  const baseUse = {
    id: 'ru1',
    referralCodeId: 'rc1',
    referredUserId: 'user2',
    rewardGranted: false,
    createdAt: new Date('2026-05-23T11:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReferralService(prismaMock as any);
  });

  // ─── getMyCode ───────────────────────────────────────────────────────────────

  describe('getMyCode', () => {
    it('returns existing code when user already has one', async () => {
      prismaMock.referralCode.findUnique.mockResolvedValue(baseCode);

      const result = await service.getMyCode('user1');

      expect(result).toEqual(baseCode);
      expect(prismaMock.referralCode.create).not.toHaveBeenCalled();
    });

    it('creates and returns a new code when none exists', async () => {
      prismaMock.referralCode.findUnique
        .mockResolvedValueOnce(null) // getMyCode lookup
        .mockResolvedValueOnce(null); // generateCode collision check
      prismaMock.referralCode.create.mockResolvedValue(baseCode);

      const result = await service.getMyCode('user1');

      expect(result).toEqual(baseCode);
      expect(prismaMock.referralCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ ownerId: 'user1' }),
      });
    });

    it('generated code is exactly 8 alphanumeric characters', async () => {
      prismaMock.referralCode.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prismaMock.referralCode.create.mockImplementation((args: any) =>
        Promise.resolve({ ...baseCode, code: args.data.code }),
      );

      const result = await service.getMyCode('user1');
      expect(result.code).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('retries code generation on collision and eventually succeeds', async () => {
      prismaMock.referralCode.findUnique
        .mockResolvedValueOnce(null) // getMyCode: no existing code for user
        .mockResolvedValueOnce({ id: 'other', code: 'XXXXXXXX' }) // first generated code collides
        .mockResolvedValueOnce(null); // second generated code is free
      prismaMock.referralCode.create.mockResolvedValue(baseCode);

      const result = await service.getMyCode('user1');
      expect(result).toEqual(baseCode);
    });
  });

  // ─── applyReferral ───────────────────────────────────────────────────────────

  describe('applyReferral', () => {
    it('creates a ReferralUse when code is valid and user has not applied one', async () => {
      prismaMock.referralUse.findUnique.mockResolvedValue(null);
      prismaMock.referralCode.findUnique.mockResolvedValue(baseCode);
      prismaMock.referralUse.create.mockResolvedValue(baseUse);

      const result = await service.applyReferral('user2', 'ABCD1234');

      expect(result).toEqual(baseUse);
      expect(prismaMock.referralUse.create).toHaveBeenCalledWith({
        data: { referralCodeId: 'rc1', referredUserId: 'user2' },
      });
    });

    it('throws BadRequestException when user already applied a code', async () => {
      prismaMock.referralUse.findUnique.mockResolvedValue(baseUse);

      await expect(service.applyReferral('user2', 'ABCD1234')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when code does not exist', async () => {
      prismaMock.referralUse.findUnique.mockResolvedValue(null);
      prismaMock.referralCode.findUnique.mockResolvedValue(null);

      await expect(
        service.applyReferral('user2', 'UNKNOWN1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when user tries to use their own code', async () => {
      prismaMock.referralUse.findUnique.mockResolvedValue(null);
      prismaMock.referralCode.findUnique.mockResolvedValue({
        ...baseCode,
        ownerId: 'user2',
      });

      await expect(
        service.applyReferral('user2', 'ABCD1234'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getMyReferrals ──────────────────────────────────────────────────────────

  describe('getMyReferrals', () => {
    it('returns list of uses when user has a referral code', async () => {
      prismaMock.referralCode.findUnique.mockResolvedValue({
        ...baseCode,
        uses: [baseUse],
      });

      const result = await service.getMyReferrals('user1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(baseUse);
    });

    it('returns empty array when user has no referral code', async () => {
      prismaMock.referralCode.findUnique.mockResolvedValue(null);

      const result = await service.getMyReferrals('user1');

      expect(result).toEqual([]);
    });

    it('returns empty array when user has code but no referrals yet', async () => {
      prismaMock.referralCode.findUnique.mockResolvedValue({
        ...baseCode,
        uses: [],
      });

      const result = await service.getMyReferrals('user1');

      expect(result).toEqual([]);
    });
  });

  // ─── grantReward ─────────────────────────────────────────────────────────────

  describe('grantReward', () => {
    it('marks rewardGranted=true on a valid pending referral use', async () => {
      prismaMock.referralUse.findUnique.mockResolvedValue(baseUse);
      const rewarded = { ...baseUse, rewardGranted: true };
      prismaMock.referralUse.update.mockResolvedValue(rewarded);

      const result = await service.grantReward('ru1');

      expect(result.rewardGranted).toBe(true);
      expect(prismaMock.referralUse.update).toHaveBeenCalledWith({
        where: { id: 'ru1' },
        data: { rewardGranted: true },
      });
    });

    it('throws NotFoundException when referralUseId does not exist', async () => {
      prismaMock.referralUse.findUnique.mockResolvedValue(null);

      await expect(service.grantReward('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when reward already granted', async () => {
      prismaMock.referralUse.findUnique.mockResolvedValue({
        ...baseUse,
        rewardGranted: true,
      });

      await expect(service.grantReward('ru1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
