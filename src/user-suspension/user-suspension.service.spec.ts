import { Test, TestingModule } from '@nestjs/testing';
import { UserSuspensionService } from './user-suspension.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockActiveUser = {
  id: 'user-1',
  bannedAt: null,
  suspendedAt: null,
  suspendedReason: null,
  suspendedById: null,
  suspendedUntil: null,
  bannedReason: null,
  bannedById: null,
  appealRequestedAt: null,
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  fraudFlag: {
    create: jest.fn(),
  },
  adminActionAudit: {
    create: jest.fn(),
  },
};

describe('UserSuspensionService', () => {
  let service: UserSuspensionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSuspensionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UserSuspensionService>(UserSuspensionService);
    jest.clearAllMocks();
  });

  describe('suspendUser', () => {
    it('suspends a user with indefinite duration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockActiveUser,
        suspendedAt: new Date(),
        suspendedReason: 'Abuse',
      });
      mockPrisma.fraudFlag.create.mockResolvedValue({});
      mockPrisma.adminActionAudit.create.mockResolvedValue({});

      const result = await service.suspendUser('user-1', 'admin-1', 'Abuse');
      expect(result.suspendedAt).toBeDefined();
      expect(mockPrisma.fraudFlag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'ADMIN_SUSPENSION' }),
        }),
      );
    });

    it('suspends a user with duration in hours', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockActiveUser,
        suspendedAt: new Date(),
        suspendedUntil: new Date(Date.now() + 24 * 3600 * 1000),
      });
      mockPrisma.fraudFlag.create.mockResolvedValue({});
      mockPrisma.adminActionAudit.create.mockResolvedValue({});

      await service.suspendUser('user-1', 'admin-1', 'Spam', 24);
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.suspendedUntil).toBeInstanceOf(Date);
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.suspendUser('x', 'admin-1', 'reason')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if user is already banned', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockActiveUser, bannedAt: new Date() });
      await expect(service.suspendUser('user-1', 'admin-1', 'reason')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unsuspendUser', () => {
    it('clears suspension fields', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        suspendedAt: new Date(),
        suspendedReason: 'Abuse',
      });
      mockPrisma.user.update.mockResolvedValue(mockActiveUser);
      mockPrisma.adminActionAudit.create.mockResolvedValue({});

      await service.unsuspendUser('user-1', 'admin-1');
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.suspendedAt).toBeNull();
    });

    it('throws BadRequestException if user is not suspended', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      await expect(service.unsuspendUser('user-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.unsuspendUser('x', 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('banUser', () => {
    it('bans a user and clears suspension', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        suspendedAt: new Date(),
      });
      mockPrisma.user.update.mockResolvedValue({
        ...mockActiveUser,
        bannedAt: new Date(),
        bannedReason: 'Fraud',
      });
      mockPrisma.adminActionAudit.create.mockResolvedValue({});

      const result = await service.banUser('user-1', 'admin-1', 'Fraud');
      expect(result.bannedAt).toBeDefined();
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.suspendedAt).toBeNull();
    });

    it('throws BadRequestException if user is already banned', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockActiveUser, bannedAt: new Date() });
      await expect(service.banUser('user-1', 'admin-1', 'reason')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.banUser('x', 'admin-1', 'reason')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserStatus', () => {
    it('returns status fields for a known user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      const result = await service.getUserStatus('user-1');
      expect(result.id).toBe('user-1');
    });

    it('throws NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserStatus('x')).rejects.toThrow(NotFoundException);
    });
  });
});
