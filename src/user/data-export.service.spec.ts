import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { DataExportService } from './data-export.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  dataExportRequest: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  transaction: { findMany: jest.fn() },
  review: { findMany: jest.fn() },
  auditAccessLog: { create: jest.fn() },
};

describe('DataExportService', () => {
  let service: DataExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataExportService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DataExportService>(DataExportService);
    jest.clearAllMocks();
  });

  describe('requestExport', () => {
    it('creates export request when none pending', async () => {
      mockPrisma.dataExportRequest.findFirst.mockResolvedValue(null);
      mockPrisma.dataExportRequest.create.mockResolvedValue({ id: 'e1', status: 'PENDING' });
      jest.spyOn(service as any, 'processExport').mockResolvedValue(undefined);

      const result = await service.requestExport('u1');

      expect(result.exportRequestId).toBe('e1');
      expect(result.status).toBe('PENDING');
      expect(mockPrisma.dataExportRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'u1' }) }),
      );
    });

    it('throws ConflictException when export already in progress', async () => {
      mockPrisma.dataExportRequest.findFirst.mockResolvedValue({ id: 'e1', status: 'PENDING' });

      await expect(service.requestExport('u1')).rejects.toThrow(ConflictException);
    });

    it('fires processExport asynchronously without awaiting', async () => {
      mockPrisma.dataExportRequest.findFirst.mockResolvedValue(null);
      mockPrisma.dataExportRequest.create.mockResolvedValue({ id: 'e2', status: 'PENDING' });
      const processExportSpy = jest
        .spyOn(service as any, 'processExport')
        .mockResolvedValue(undefined);

      await service.requestExport('u1');

      expect(processExportSpy).toHaveBeenCalledWith('e2', 'u1');
    });
  });

  describe('getDownloadUrl', () => {
    it('throws NotFoundException for unknown export', async () => {
      mockPrisma.dataExportRequest.findUnique.mockResolvedValue(null);

      await expect(service.getDownloadUrl('bad', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for wrong user', async () => {
      mockPrisma.dataExportRequest.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'u2',
        status: 'READY',
        downloadUrl: 'https://example.com/export.json',
        expiresAt: new Date(),
        accessCount: 0,
      });

      await expect(service.getDownloadUrl('e1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when export not ready', async () => {
      mockPrisma.dataExportRequest.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'u1',
        status: 'PROCESSING',
        downloadUrl: null,
        expiresAt: null,
        accessCount: 0,
      });

      await expect(service.getDownloadUrl('e1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('throws GoneException on second access', async () => {
      mockPrisma.dataExportRequest.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'u1',
        status: 'READY',
        downloadUrl: 'https://example.com/export.json',
        expiresAt: new Date(Date.now() + 3600000),
        accessCount: 1,
      });

      await expect(service.getDownloadUrl('e1', 'u1')).rejects.toThrow(GoneException);
    });

    it('returns download URL on first access and increments counter', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      mockPrisma.dataExportRequest.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'u1',
        status: 'READY',
        downloadUrl: 'https://s3.example.com/export.json',
        expiresAt,
        accessCount: 0,
      });
      mockPrisma.dataExportRequest.update.mockResolvedValue({});
      mockPrisma.auditAccessLog.create.mockResolvedValue({});

      const result = await service.getDownloadUrl('e1', 'u1');

      expect(result.downloadUrl).toBe('https://s3.example.com/export.json');
      expect(result.expiresAt).toBe(expiresAt.toISOString());
      expect(mockPrisma.dataExportRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ accessCount: { increment: 1 } }),
        }),
      );
    });

    it('throws ConflictException for FAILED export', async () => {
      mockPrisma.dataExportRequest.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'u1',
        status: 'FAILED',
        downloadUrl: null,
        expiresAt: null,
        accessCount: 0,
      });

      await expect(service.getDownloadUrl('e1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException for PENDING export', async () => {
      mockPrisma.dataExportRequest.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'u1',
        status: 'PENDING',
        downloadUrl: null,
        expiresAt: null,
        accessCount: 0,
      });

      await expect(service.getDownloadUrl('e1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('logs access in AuditAccessLog (non-blocking)', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      mockPrisma.dataExportRequest.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'u1',
        status: 'READY',
        downloadUrl: 'https://s3.example.com/export.json',
        expiresAt,
        accessCount: 0,
      });
      mockPrisma.dataExportRequest.update.mockResolvedValue({});
      mockPrisma.auditAccessLog.create.mockResolvedValue({});

      await service.getDownloadUrl('e1', 'u1');

      // Allow the non-blocking promise to settle
      await new Promise((r) => setImmediate(r));

      expect(mockPrisma.auditAccessLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessedById: 'u1',
            targetType: 'DATA_EXPORT',
            targetId: 'e1',
          }),
        }),
      );
    });
  });
});
