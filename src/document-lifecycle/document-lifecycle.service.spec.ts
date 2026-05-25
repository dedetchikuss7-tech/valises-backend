import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentLifecycleService } from './document-lifecycle.service';

describe('DocumentLifecycleService', () => {
  let service: DocumentLifecycleService;
  let prisma: any;

  const mockUser = {
    id: 'u1',
    email: 'user@test.com',
    deletionStatus: null,
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      documentAccessLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentLifecycleService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DocumentLifecycleService>(DocumentLifecycleService);
  });

  describe('requestDataDeletion', () => {
    it('sets deletionStatus to DELETION_PENDING', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      const result = await service.requestDataDeletion('u1');

      expect(result.status).toBe('DELETION_PENDING');
      expect(result.scheduledAt).toBeInstanceOf(Date);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ deletionStatus: 'DELETION_PENDING' }),
        }),
      );
    });

    it('throws NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.requestDataDeletion('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if deletion already pending', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        deletionStatus: 'DELETION_PENDING',
      });
      await expect(service.requestDataDeletion('u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('scheduledAt is ~30 days from now', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      const before = Date.now();
      const result = await service.requestDataDeletion('u1');
      const after = Date.now();

      const expectedMs = 30 * 24 * 60 * 60 * 1000;
      expect(result.scheduledAt.getTime()).toBeGreaterThanOrEqual(
        before + expectedMs - 1000,
      );
      expect(result.scheduledAt.getTime()).toBeLessThanOrEqual(
        after + expectedMs + 1000,
      );
    });
  });

  describe('executeDataDeletion', () => {
    it('anonymizes email and sets deletedAt', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      await service.executeDataDeletion('u1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({
            email: 'deleted_u1@deleted.invalid',
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.executeDataDeletion('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('anonymized email contains userId for traceability', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      await service.executeDataDeletion('u1');

      const call = prisma.user.update.mock.calls[0][0];
      expect(call.data.email).toContain('u1');
      expect(call.data.email).toContain('@deleted.invalid');
    });
  });

  describe('logDocumentAccess', () => {
    it('creates a DocumentAccessLog entry', async () => {
      prisma.documentAccessLog.create.mockResolvedValue({});

      await service.logDocumentAccess({
        userId: 'u1',
        documentId: 'doc1',
        accessedBy: 'admin1',
        endpoint: 'GET /admin/document-access-logs/u1',
      });

      expect(prisma.documentAccessLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            documentId: 'doc1',
            accessedBy: 'admin1',
          }),
        }),
      );
    });
  });

  describe('getDocumentAccessLogs', () => {
    it('returns logs ordered by accessedAt desc', async () => {
      const logs = [{ id: 'l1', userId: 'u1', accessedAt: new Date() }];
      prisma.documentAccessLog.findMany.mockResolvedValue(logs);

      const result = await service.getDocumentAccessLogs('u1');

      expect(result).toHaveLength(1);
      expect(prisma.documentAccessLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          orderBy: { accessedAt: 'desc' },
        }),
      );
    });

    it('returns empty array if no logs', async () => {
      prisma.documentAccessLog.findMany.mockResolvedValue([]);
      const result = await service.getDocumentAccessLogs('u1');
      expect(result).toHaveLength(0);
    });
  });

  describe('runKycRetentionCleanup', () => {
    it('returns cleaned count', async () => {
      const result = await service.runKycRetentionCleanup();
      expect(result).toHaveProperty('cleaned');
      expect(typeof result.cleaned).toBe('number');
    });
  });
});
