import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceService } from './evidence.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { STORAGE_PROVIDER } from '../storage/storage.provider';
import { getMimeFromFilename, isAllowedMime } from './evidence-validation';

const mockPrisma = {
  dispute: { findUnique: jest.fn() },
  disputeEvidence: { count: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  documentAccessLog: { create: jest.fn() },
};

const mockStorage = {
  prepareUpload: jest.fn(),
  confirmUpload: jest.fn(),
};

const baseDispute = {
  id: 'd1',
  status: 'OPEN',
  transaction: { senderId: 'u1', travelerId: 'u2' },
};

const mockUploadResult = {
  uploadUrl: 'https://mock-storage.local/upload/evidence%2Fd1%2Fphoto.jpg?token=abc',
  expiresInSeconds: 900,
  storageKey: 'evidence/d1/photo.jpg',
  method: 'PUT' as const,
  headers: { 'content-type': 'image/jpeg' },
  provider: 'MOCK_STORAGE' as any,
  uploadStatus: 'PENDING_CLIENT_UPLOAD' as const,
  providerUploadId: null,
  objectUrl: null,
  publicUrl: null,
  maxAllowedSizeBytes: null,
};

describe('EvidenceService', () => {
  let service: EvidenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: STORAGE_PROVIDER, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
    jest.clearAllMocks();
  });

  describe('requestUploadUrl', () => {
    it('throws NotFoundException for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);
      await expect(
        service.requestUploadUrl('bad', 'u1', {
          filename: 'photo.jpg',
          kind: 'PHOTO' as any,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for non-participant', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(baseDispute);
      await expect(
        service.requestUploadUrl('d1', 'stranger', {
          filename: 'photo.jpg',
          kind: 'PHOTO' as any,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for disallowed file type', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(baseDispute);
      mockPrisma.disputeEvidence.count.mockResolvedValue(0);
      await expect(
        service.requestUploadUrl('d1', 'u1', {
          filename: 'malware.exe',
          kind: 'DOCUMENT' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when 5 files already uploaded', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(baseDispute);
      mockPrisma.disputeEvidence.count.mockResolvedValue(5);
      await expect(
        service.requestUploadUrl('d1', 'u1', {
          filename: 'photo.jpg',
          kind: 'PHOTO' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns upload URL for valid request', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(baseDispute);
      mockPrisma.disputeEvidence.count.mockResolvedValue(2);
      mockStorage.prepareUpload.mockResolvedValue(mockUploadResult);
      mockPrisma.disputeEvidence.create.mockResolvedValue({
        id: 'e1',
        storageKey: 'evidence/d1/photo.jpg',
        mimeType: 'image/jpeg',
        originalFilename: 'photo.jpg',
      });

      const result = await service.requestUploadUrl('d1', 'u1', {
        filename: 'photo.jpg',
        kind: 'PHOTO' as any,
      });

      expect(result.evidenceId).toBe('e1');
      expect(result.maxSizeBytes).toBe(10 * 1024 * 1024);
      expect(result.contentType).toBe('image/jpeg');
      expect(result.uploadUrl).toBeTruthy();
    });
  });

  describe('getEvidenceList', () => {
    it('throws NotFoundException for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);
      await expect(service.getEvidenceList('bad', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for non-participant', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(baseDispute);
      await expect(
        service.getEvidenceList('d1', 'stranger'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns evidence list and logs access', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(baseDispute);
      mockPrisma.disputeEvidence.findMany.mockResolvedValue([
        {
          id: 'e1',
          originalFilename: 'photo.jpg',
          mimeType: 'image/jpeg',
          fileSizeBytes: 204800,
          storageKey: 'evidence/d1/photo.jpg',
          createdAt: new Date(),
          uploadedById: 'u1',
        },
      ]);
      mockPrisma.documentAccessLog.create.mockResolvedValue({});

      const result = await service.getEvidenceList('d1', 'u1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.documentAccessLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            documentId: 'd1',
            endpoint: 'GET /disputes/d1/evidence',
          }),
        }),
      );
    });
  });
});

describe('evidence-validation helpers', () => {
  it('returns correct MIME for jpg', () => {
    expect(getMimeFromFilename('photo.jpg')).toBe('image/jpeg');
    expect(getMimeFromFilename('photo.jpeg')).toBe('image/jpeg');
  });

  it('returns null for unknown extension', () => {
    expect(getMimeFromFilename('malware.exe')).toBeNull();
  });

  it('isAllowedMime returns true for pdf', () => {
    expect(isAllowedMime('application/pdf')).toBe(true);
  });

  it('isAllowedMime returns false for mp4', () => {
    expect(isAllowedMime('video/mp4')).toBe(false);
  });
});
