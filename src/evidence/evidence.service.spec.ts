import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentType,
  EvidenceAttachmentVisibility,
  Role,
} from '@prisma/client';
import { EvidenceService } from './evidence.service';
import {
  EvidenceAttachmentSortBy,
  SortOrder,
} from './dto/list-evidence-attachments-query.dto';

describe('EvidenceService', () => {
  let service: EvidenceService;

  const now = new Date('2026-04-26T10:00:00.000Z');

  const evidenceAttachmentMock = {
    id: 'ev-1',
    targetType: EvidenceAttachmentObjectType.PACKAGE,
    targetId: 'pkg-1',
    attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
    status: EvidenceAttachmentStatus.PENDING_REVIEW,
    visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
    uploadedById: 'user-1',
    reviewedByAdminId: null,
    reviewedAt: null,
    label: 'Package photo',
    fileUrl: 'https://storage.example.com/pkg-1/photo.jpg',
    storageKey: 'pkg-1/photo.jpg',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 12345,
    rejectionReason: null,
    reviewNotes: null,
    metadata: { source: 'test' },
    createdAt: now,
    updatedAt: now,
  };

  const prismaMock = {
    evidenceAttachment: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new EvidenceService(prismaMock as any);
  });

  it('creates an evidence attachment reference', async () => {
    prismaMock.evidenceAttachment.create.mockResolvedValue(evidenceAttachmentMock);

    const result = await service.create('user-1', {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
      visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
      label: ' Package photo ',
      fileUrl: ' https://storage.example.com/pkg-1/photo.jpg ',
      storageKey: ' pkg-1/photo.jpg ',
      fileName: ' photo.jpg ',
      mimeType: ' image/jpeg ',
      sizeBytes: 12345,
      metadata: { source: 'test' },
    });

    expect(prismaMock.evidenceAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
        uploadedById: 'user-1',
        label: 'Package photo',
        fileUrl: 'https://storage.example.com/pkg-1/photo.jpg',
        storageKey: 'pkg-1/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
        metadata: { source: 'test' },
      }),
    });

    expect(result.id).toBe('ev-1');
    expect(result.metadata).toEqual({ source: 'test' });
  });

  it('lists own attachments for a normal user', async () => {
    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceAttachmentMock,
    ]);
    prismaMock.evidenceAttachment.count.mockResolvedValue(1);

    const result = await service.list('user-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      limit: 20,
      offset: 0,
    });

    expect(prismaMock.evidenceAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetType: EvidenceAttachmentObjectType.PACKAGE,
          targetId: 'pkg-1',
          uploadedById: 'user-1',
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('ev-1');
  });

  it('allows admin to filter by uploader', async () => {
    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceAttachmentMock,
    ]);
    prismaMock.evidenceAttachment.count.mockResolvedValue(1);

    await service.list('admin-1', Role.ADMIN, {
      uploadedById: 'user-1',
      status: EvidenceAttachmentStatus.PENDING_REVIEW,
      q: 'photo',
      sortBy: EvidenceAttachmentSortBy.STATUS,
      sortOrder: SortOrder.ASC,
      limit: 10,
      offset: 0,
    });

    expect(prismaMock.evidenceAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          uploadedById: 'user-1',
          status: EvidenceAttachmentStatus.PENDING_REVIEW,
        }),
        orderBy: [
          { status: 'asc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      }),
    );
  });

  it('returns one attachment for owner', async () => {
    prismaMock.evidenceAttachment.findUnique.mockResolvedValue(
      evidenceAttachmentMock,
    );

    const result = await service.getOne('user-1', Role.USER, 'ev-1');

    expect(result.id).toBe('ev-1');
  });

  it('rejects read access for non-owner normal user', async () => {
    prismaMock.evidenceAttachment.findUnique.mockResolvedValue(
      evidenceAttachmentMock,
    );

    await expect(
      service.getOne('other-user', Role.USER, 'ev-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFoundException when attachment is missing', async () => {
    prismaMock.evidenceAttachment.findUnique.mockResolvedValue(null);

    await expect(
      service.getOne('user-1', Role.USER, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows admin to accept an evidence attachment', async () => {
    prismaMock.evidenceAttachment.findUnique.mockResolvedValue(
      evidenceAttachmentMock,
    );
    prismaMock.evidenceAttachment.update.mockResolvedValue({
      ...evidenceAttachmentMock,
      status: EvidenceAttachmentStatus.ACCEPTED,
      reviewedByAdminId: 'admin-1',
      reviewedAt: now,
      reviewNotes: 'Looks good',
    });

    const result = await service.review('admin-1', Role.ADMIN, 'ev-1', {
      status: EvidenceAttachmentStatus.ACCEPTED,
      reviewNotes: 'Looks good',
    });

    expect(prismaMock.evidenceAttachment.update).toHaveBeenCalledWith({
      where: { id: 'ev-1' },
      data: expect.objectContaining({
        status: EvidenceAttachmentStatus.ACCEPTED,
        reviewedByAdminId: 'admin-1',
        reviewNotes: 'Looks good',
        rejectionReason: null,
      }),
    });
    expect(result.status).toBe(EvidenceAttachmentStatus.ACCEPTED);
  });

  it('allows admin to reject an evidence attachment with rejection reason', async () => {
    prismaMock.evidenceAttachment.findUnique.mockResolvedValue(
      evidenceAttachmentMock,
    );
    prismaMock.evidenceAttachment.update.mockResolvedValue({
      ...evidenceAttachmentMock,
      status: EvidenceAttachmentStatus.REJECTED,
      reviewedByAdminId: 'admin-1',
      reviewedAt: now,
      rejectionReason: 'Blurry image',
    });

    const result = await service.review('admin-1', Role.ADMIN, 'ev-1', {
      status: EvidenceAttachmentStatus.REJECTED,
      rejectionReason: 'Blurry image',
    });

    expect(result.status).toBe(EvidenceAttachmentStatus.REJECTED);
    expect(result.rejectionReason).toBe('Blurry image');
  });

  it('rejects review by non-admin', async () => {
    await expect(
      service.review('user-1', Role.USER, 'ev-1', {
        status: EvidenceAttachmentStatus.ACCEPTED,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.evidenceAttachment.findUnique).not.toHaveBeenCalled();
  });

  it('rejects admin review reset to pending review', async () => {
    await expect(
      service.review('admin-1', Role.ADMIN, 'ev-1', {
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.evidenceAttachment.findUnique).not.toHaveBeenCalled();
  });
});