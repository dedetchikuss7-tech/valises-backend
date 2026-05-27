import { Test, TestingModule } from '@nestjs/testing';
import { KycRetryService } from './kyc-retry.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  adminActionAudit: {
    create: jest.fn(),
  },
};

const rejectedUser = {
  id: 'user-1',
  kycStatus: 'REJECTED',
  kycAttemptCount: 1,
  kycRejectionReason: 'Document blurry',
  kycLastAttemptAt: new Date(),
};

describe('KycRetryService', () => {
  let service: KycRetryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycRetryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<KycRetryService>(KycRetryService);
    jest.clearAllMocks();
  });

  describe('retryKyc', () => {
    it('resets status to PENDING when attempt count is under limit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(rejectedUser);
      mockPrisma.user.update.mockResolvedValue({ ...rejectedUser, kycStatus: 'PENDING' });

      const result = await service.retryKyc('user-1');
      expect(result.attemptCount).toBe(2);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kycStatus: 'PENDING' }),
        }),
      );
    });

    it('throws BadRequestException if status is not REJECTED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...rejectedUser, kycStatus: 'VERIFIED' });
      await expect(service.retryKyc('user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if max attempts reached', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...rejectedUser, kycAttemptCount: 3 });
      await expect(service.retryKyc('user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.retryKyc('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getKycStatus', () => {
    it('returns full status with canRetry true when REJECTED and under limit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(rejectedUser);
      const result = await service.getKycStatus('user-1');
      expect(result.status).toBe('REJECTED');
      expect(result.canRetry).toBe(true);
      expect(result.attemptsRemaining).toBe(2);
      expect(result.rejectionReason).toBe('Document blurry');
    });

    it('returns canRetry false when attempt count at max', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...rejectedUser, kycAttemptCount: 3 });
      const result = await service.getKycStatus('user-1');
      expect(result.canRetry).toBe(false);
      expect(result.attemptsRemaining).toBe(0);
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getKycStatus('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminOverrideKyc', () => {
    it('overrides status to VERIFIED and creates audit trail', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(rejectedUser);
      mockPrisma.user.update.mockResolvedValue({ ...rejectedUser, kycStatus: 'VERIFIED' });
      mockPrisma.adminActionAudit.create.mockResolvedValue({});

      const result = await service.adminOverrideKyc('user-1', 'admin-1', 'VERIFIED', 'Manual review approved');
      expect(result.newStatus).toBe('VERIFIED');
      expect(mockPrisma.adminActionAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorUserId: 'admin-1',
            action: 'KYC_STATUS_OVERRIDE',
          }),
        }),
      );
    });

    it('throws BadRequestException if reason is empty', async () => {
      await expect(
        service.adminOverrideKyc('user-1', 'admin-1', 'VERIFIED', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if reason is whitespace only', async () => {
      await expect(
        service.adminOverrideKyc('user-1', 'admin-1', 'VERIFIED', '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.adminOverrideKyc('unknown', 'admin-1', 'VERIFIED', 'reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('clears rejectionReason when overriding to VERIFIED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(rejectedUser);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.adminActionAudit.create.mockResolvedValue({});

      await service.adminOverrideKyc('user-1', 'admin-1', 'VERIFIED', 'Approved manually');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kycRejectionReason: null }),
        }),
      );
    });
  });
});
