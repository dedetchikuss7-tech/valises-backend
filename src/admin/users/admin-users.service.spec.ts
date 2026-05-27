import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  fraudFlag: {
    findMany: jest.fn(),
  },
  transaction: {
    count: jest.fn(),
  },
  adminActionAudit: {
    create: jest.fn(),
  },
};

describe('AdminUsersService', () => {
  let service: AdminUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('returns paginated users with no filters', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'a@test.com', kycStatus: 'VERIFIED', trustProfile: { score: 60 }, suspendedAt: null, bannedAt: null, createdAt: new Date(), _count: { sentTransactions: 3, travelTransactions: 0 } },
        { id: 'u2', email: 'b@test.com', kycStatus: 'PENDING', trustProfile: { score: 10 }, suspendedAt: null, bannedAt: null, createdAt: new Date(), _count: { sentTransactions: 0, travelTransactions: 0 } },
      ]);

      const result = await service.listUsers({ limit: 20 });
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('filters by trustLevel TRUSTED post-query', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', trustProfile: { score: 65 }, kycStatus: 'VERIFIED', suspendedAt: null, bannedAt: null, createdAt: new Date(), _count: { sentTransactions: 1, travelTransactions: 0 } },
        { id: 'u2', trustProfile: { score: 15 }, kycStatus: 'PENDING', suspendedAt: null, bannedAt: null, createdAt: new Date(), _count: { sentTransactions: 0, travelTransactions: 0 } },
      ]);

      const result = await service.listUsers({ limit: 20, trustLevel: 'TRUSTED' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('u1');
    });

    it('sets hasMore=true when more results exist', async () => {
      const users = Array.from({ length: 21 }, (_, i) => ({
        id: `u${i}`,
        email: `u${i}@test.com`,
        kycStatus: 'VERIFIED',
        trustProfile: { score: 50 },
        suspendedAt: null,
        bannedAt: null,
        createdAt: new Date(),
        _count: { sentTransactions: 0, travelTransactions: 0 },
      }));
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await service.listUsers({ limit: 20 });
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('u19');
    });
  });

  describe('getUserProfile', () => {
    it('returns enriched profile with fraud flags and transaction stats', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@test.com',
        kycStatus: 'VERIFIED',
        trustProfile: { score: 75, status: 'NORMAL' },
        kycAttemptCount: 1,
        kycRejectionReason: null,
        kycLastAttemptAt: null,
        suspendedAt: null,
        suspendedReason: null,
        suspendedUntil: null,
        bannedAt: null,
        bannedReason: null,
        appealRequestedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.fraudFlag.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(5);

      const result = await service.getUserProfile('u1');
      expect(result.trustLevel).toBe('TRUSTED');
      expect(result.transactionStats.total).toBe(10);
      expect(result.activeFraudFlags).toHaveLength(0);
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserProfile('unknown')).rejects.toThrow(NotFoundException);
    });

    it('assigns HIGH_TRUST for score >= 80', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', kycStatus: 'VERIFIED', trustProfile: { score: 85, status: 'NORMAL' },
        kycAttemptCount: 2, kycRejectionReason: null, kycLastAttemptAt: null,
        suspendedAt: null, suspendedReason: null, suspendedUntil: null,
        bannedAt: null, bannedReason: null, appealRequestedAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      });
      mockPrisma.fraudFlag.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      const result = await service.getUserProfile('u1');
      expect(result.trustLevel).toBe('HIGH_TRUST');
    });

    it('assigns EXPLORER for score < 20', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', kycStatus: 'PENDING', trustProfile: null,
        kycAttemptCount: 0, kycRejectionReason: null, kycLastAttemptAt: null,
        suspendedAt: null, suspendedReason: null, suspendedUntil: null,
        bannedAt: null, bannedReason: null, appealRequestedAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      });
      mockPrisma.fraudFlag.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      const result = await service.getUserProfile('u1');
      expect(result.trustLevel).toBe('EXPLORER');
    });
  });

  describe('overrideKycStatus', () => {
    it('overrides KYC to VERIFIED and clears rejectionReason', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', kycStatus: 'REJECTED' });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', kycStatus: 'VERIFIED', kycRejectionReason: null });
      mockPrisma.adminActionAudit.create.mockResolvedValue({});

      const result = await service.overrideKycStatus('u1', 'admin1', {
        status: 'VERIFIED' as any,
        reason: 'Documents verified manually by ops team',
      });

      expect(result.kycStatus).toBe('VERIFIED');
      expect(mockPrisma.adminActionAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actorUserId: 'admin1', action: 'KYC_STATUS_OVERRIDE' }),
        }),
      );
    });

    it('rejects override with reason shorter than 10 chars', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', kycStatus: 'REJECTED' });
      await expect(
        service.overrideKycStatus('u1', 'admin1', { status: 'VERIFIED' as any, reason: 'short' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.overrideKycStatus('unknown', 'admin1', { status: 'VERIFIED' as any, reason: 'valid reason here' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('stores rejection reason with ADMIN OVERRIDE prefix when overriding to REJECTED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', kycStatus: 'VERIFIED' });
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        kycStatus: 'REJECTED',
        kycRejectionReason: '[ADMIN OVERRIDE] Fraud suspected',
      });
      mockPrisma.adminActionAudit.create.mockResolvedValue({});

      await service.overrideKycStatus('u1', 'admin1', {
        status: 'REJECTED' as any,
        reason: 'Fraud suspected after manual review',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kycRejectionReason: expect.stringContaining('[ADMIN OVERRIDE]'),
          }),
        }),
      );
    });
  });
});
