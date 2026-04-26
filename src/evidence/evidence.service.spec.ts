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
  TransactionStatus,
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
    provider: null,
    providerUploadId: null,
    storageKey: 'pkg-1/photo.jpg',
    objectUrl: null,
    publicUrl: null,
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
    package: {
      findUnique: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    dispute: {
      findUnique: jest.fn(),
    },
    payout: {
      findUnique: jest.fn(),
    },
    refund: {
      findUnique: jest.fn(),
    },
    kycVerification: {
      findUnique: jest.fn(),
    },
  };

  const adminActionAuditServiceMock = {
    recordSafe: jest.fn(),
  };

  const adminTimelineServiceMock = {
    recordSafe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    adminActionAuditServiceMock.recordSafe.mockResolvedValue(undefined);
    adminTimelineServiceMock.recordSafe.mockResolvedValue(undefined);

    service = new EvidenceService(
      prismaMock as any,
      adminActionAuditServiceMock as any,
      adminTimelineServiceMock as any,
    );
  });

  it('creates an evidence attachment reference after validating package ownership', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'user-1',
    });
    prismaMock.evidenceAttachment.create.mockResolvedValue(evidenceAttachmentMock);

    const result = await service.create('user-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
      visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
      label: ' Package photo ',
      fileUrl: ' https://storage.example.com/pkg-1/photo.jpg ',
      storageKey: ' pkg-1/photo.jpg ',
      fileName: ' photo.jpg ',
      mimeType: ' IMAGE/JPEG ',
      sizeBytes: 12345,
      metadata: { source: 'test' },
    });

    expect(prismaMock.package.findUnique).toHaveBeenCalledWith({
      where: { id: 'pkg-1' },
      select: {
        id: true,
        senderId: true,
      },
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
        provider: null,
        providerUploadId: null,
        storageKey: 'pkg-1/photo.jpg',
        objectUrl: null,
        publicUrl: null,
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
        metadata: { source: 'test' },
      }),
    });

    expect(result.id).toBe('ev-1');
    expect(result.metadata).toEqual({ source: 'test' });
  });

  it('creates evidence attachment from storage metadata without explicit fileUrl', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'user-1',
    });

    prismaMock.evidenceAttachment.create.mockResolvedValue({
      ...evidenceAttachmentMock,
      fileUrl: 'https://mock-storage.local/object/pkg-1-photo',
      provider: 'MOCK_STORAGE',
      providerUploadId: 'mock-upload:pkg-1-photo',
      objectUrl: 'https://mock-storage.local/object/pkg-1-photo',
      publicUrl: null,
    });

    const result = await service.create('user-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
      visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
      label: 'Package photo',
      provider: 'MOCK_STORAGE',
      providerUploadId: 'mock-upload:pkg-1-photo',
      storageKey: 'pending/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
      objectUrl: 'https://mock-storage.local/object/pkg-1-photo',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 12345,
    });

    expect(prismaMock.evidenceAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fileUrl: 'https://mock-storage.local/object/pkg-1-photo',
        provider: 'MOCK_STORAGE',
        providerUploadId: 'mock-upload:pkg-1-photo',
        storageKey:
          'pending/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
        objectUrl: 'https://mock-storage.local/object/pkg-1-photo',
        publicUrl: null,
      }),
    });

    expect(result.provider).toBe('MOCK_STORAGE');
    expect(result.objectUrl).toBe('https://mock-storage.local/object/pkg-1-photo');
  });

  it('rejects evidence creation when no file reference is provided', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'user-1',
    });

    await expect(
      service.create('user-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        label: 'Package photo',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.evidenceAttachment.create).not.toHaveBeenCalled();
  });

  it('allows traveler to create package evidence when linked to an active transaction', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
    });
    prismaMock.transaction.findFirst.mockResolvedValue({
      senderId: 'sender-1',
      travelerId: 'traveler-1',
    });
    prismaMock.evidenceAttachment.create.mockResolvedValue({
      ...evidenceAttachmentMock,
      uploadedById: 'traveler-1',
    });

    const result = await service.create('traveler-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
      label: 'Package photo',
      fileUrl: 'https://storage.example.com/pkg-1/photo.jpg',
    });

    expect(prismaMock.transaction.findFirst).toHaveBeenCalledWith({
      where: {
        packageId: 'pkg-1',
        NOT: { status: TransactionStatus.CANCELLED },
      },
      select: {
        senderId: true,
        travelerId: true,
      },
    });
    expect(result.uploadedById).toBe('traveler-1');
  });

  it('rejects evidence creation on another user package', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
    });
    prismaMock.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.create('outsider-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        label: 'Package photo',
        fileUrl: 'https://storage.example.com/pkg-1/photo.jpg',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.evidenceAttachment.create).not.toHaveBeenCalled();
  });

  it('rejects evidence creation on missing package target', async () => {
    prismaMock.package.findUnique.mockResolvedValue(null);

    await expect(
      service.create('user-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'missing',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        label: 'Package photo',
        fileUrl: 'https://storage.example.com/missing/photo.jpg',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows transaction party to create transaction evidence', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
    });
    prismaMock.evidenceAttachment.create.mockResolvedValue({
      ...evidenceAttachmentMock,
      targetType: EvidenceAttachmentObjectType.TRANSACTION,
      targetId: 'tx-1',
      uploadedById: 'sender-1',
    });

    const result = await service.create('sender-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.TRANSACTION,
      targetId: 'tx-1',
      attachmentType: EvidenceAttachmentType.DOCUMENT,
      label: 'Transaction document',
      fileUrl: 'https://storage.example.com/tx-1/document.pdf',
    });

    expect(result.targetType).toBe(EvidenceAttachmentObjectType.TRANSACTION);
  });

  it('allows dispute party to create dispute evidence', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'disp-1',
      openedById: 'sender-1',
      transaction: {
        senderId: 'sender-1',
        travelerId: 'traveler-1',
      },
    });
    prismaMock.evidenceAttachment.create.mockResolvedValue({
      ...evidenceAttachmentMock,
      targetType: EvidenceAttachmentObjectType.DISPUTE,
      targetId: 'disp-1',
      uploadedById: 'traveler-1',
    });

    const result = await service.create('traveler-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.DISPUTE,
      targetId: 'disp-1',
      attachmentType: EvidenceAttachmentType.DISPUTE_EVIDENCE,
      label: 'Dispute evidence',
      fileUrl: 'https://storage.example.com/disp-1/evidence.jpg',
    });

    expect(result.targetType).toBe(EvidenceAttachmentObjectType.DISPUTE);
  });

  it('rejects normal user evidence creation on admin-only target type', async () => {
    await expect(
      service.create('user-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.ADMIN_CASE,
        targetId: 'case-1',
        attachmentType: EvidenceAttachmentType.ADMIN_NOTE_ATTACHMENT,
        label: 'Admin case attachment',
        fileUrl: 'https://storage.example.com/admin/case-1.pdf',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.evidenceAttachment.create).not.toHaveBeenCalled();
  });

  it('allows admin to create evidence when target exists', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
    });
    prismaMock.evidenceAttachment.create.mockResolvedValue({
      ...evidenceAttachmentMock,
      targetType: EvidenceAttachmentObjectType.TRANSACTION,
      targetId: 'tx-1',
      uploadedById: 'admin-1',
    });

    const result = await service.create('admin-1', Role.ADMIN, {
      targetType: EvidenceAttachmentObjectType.TRANSACTION,
      targetId: 'tx-1',
      attachmentType: EvidenceAttachmentType.DOCUMENT,
      label: 'Admin evidence',
      fileUrl: 'https://storage.example.com/tx-1/admin.pdf',
    });

    expect(result.uploadedById).toBe('admin-1');
  });

  it('lists own attachments for a normal user when no target filter is provided', async () => {
    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceAttachmentMock,
    ]);
    prismaMock.evidenceAttachment.count.mockResolvedValue(1);

    const result = await service.list('user-1', Role.USER, {
      limit: 20,
      offset: 0,
    });

    expect(prismaMock.evidenceAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          uploadedById: 'user-1',
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('ev-1');
  });

  it('validates target access when normal user lists by target', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'user-1',
    });
    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      {
        ...evidenceAttachmentMock,
        visibility: EvidenceAttachmentVisibility.PARTIES,
      },
    ]);
    prismaMock.evidenceAttachment.count.mockResolvedValue(1);

    const result = await service.list('user-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      limit: 20,
      offset: 0,
    });

    expect(prismaMock.package.findUnique).toHaveBeenCalled();
    expect(result.total).toBe(1);
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

  it('rejects read access for non-owner normal user when visibility is admin-only', async () => {
    prismaMock.evidenceAttachment.findUnique.mockResolvedValue(
      evidenceAttachmentMock,
    );

    await expect(
      service.getOne('other-user', Role.USER, 'ev-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows target participant to read parties-visible evidence', async () => {
    prismaMock.evidenceAttachment.findUnique.mockResolvedValue({
      ...evidenceAttachmentMock,
      uploadedById: 'sender-1',
      visibility: EvidenceAttachmentVisibility.PARTIES,
    });
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
    });
    prismaMock.transaction.findFirst.mockResolvedValue({
      senderId: 'sender-1',
      travelerId: 'traveler-1',
    });

    const result = await service.getOne('traveler-1', Role.USER, 'ev-1');

    expect(result.id).toBe('ev-1');
  });

  it('throws NotFoundException when attachment is missing', async () => {
    prismaMock.evidenceAttachment.findUnique.mockResolvedValue(null);

    await expect(
      service.getOne('user-1', Role.USER, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows admin to accept an evidence attachment and records audit/timeline traces', async () => {
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

    expect(adminActionAuditServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EVIDENCE_ACCEPTED',
        targetType: 'EVIDENCE_ATTACHMENT',
        targetId: 'ev-1',
        actorUserId: 'admin-1',
        metadata: expect.objectContaining({
          evidenceId: 'ev-1',
          previousStatus: EvidenceAttachmentStatus.PENDING_REVIEW,
          newStatus: EvidenceAttachmentStatus.ACCEPTED,
          reviewNotes: 'Looks good',
          storageKey: 'pkg-1/photo.jpg',
        }),
      }),
    );

    expect(adminTimelineServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        objectType: 'ADMIN_CASE',
        objectId: 'ev-1',
        eventType: 'EVIDENCE_ACCEPTED',
        title: 'Evidence attachment accepted',
        actorUserId: 'admin-1',
        severity: 'INFO',
        metadata: expect.objectContaining({
          evidenceId: 'ev-1',
          newStatus: EvidenceAttachmentStatus.ACCEPTED,
        }),
      }),
    );

    expect(result.status).toBe(EvidenceAttachmentStatus.ACCEPTED);
  });

  it('allows admin to reject an evidence attachment and records audit/timeline traces', async () => {
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

    expect(adminActionAuditServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EVIDENCE_REJECTED',
        targetType: 'EVIDENCE_ATTACHMENT',
        targetId: 'ev-1',
        actorUserId: 'admin-1',
        metadata: expect.objectContaining({
          evidenceId: 'ev-1',
          previousStatus: EvidenceAttachmentStatus.PENDING_REVIEW,
          newStatus: EvidenceAttachmentStatus.REJECTED,
          rejectionReason: 'Blurry image',
        }),
      }),
    );

    expect(adminTimelineServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        objectType: 'ADMIN_CASE',
        objectId: 'ev-1',
        eventType: 'EVIDENCE_REJECTED',
        title: 'Evidence attachment rejected',
        actorUserId: 'admin-1',
        severity: 'WARNING',
        metadata: expect.objectContaining({
          evidenceId: 'ev-1',
          newStatus: EvidenceAttachmentStatus.REJECTED,
          rejectionReason: 'Blurry image',
        }),
      }),
    );

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
    expect(adminActionAuditServiceMock.recordSafe).not.toHaveBeenCalled();
    expect(adminTimelineServiceMock.recordSafe).not.toHaveBeenCalled();
  });

  it('rejects admin review reset to pending review', async () => {
    await expect(
      service.review('admin-1', Role.ADMIN, 'ev-1', {
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.evidenceAttachment.findUnique).not.toHaveBeenCalled();
    expect(adminActionAuditServiceMock.recordSafe).not.toHaveBeenCalled();
    expect(adminTimelineServiceMock.recordSafe).not.toHaveBeenCalled();
  });

  it('returns admin evidence summary counts', async () => {
    prismaMock.evidenceAttachment.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const result = await service.getAdminSummary(Role.ADMIN);

    expect(result.totalAttachments).toBe(10);
    expect(result.pendingReviewCount).toBe(4);
    expect(result.acceptedCount).toBe(5);
    expect(result.rejectedCount).toBe(1);
    expect(result.packageEvidenceCount).toBe(3);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('rejects admin evidence summary for non-admin', async () => {
    await expect(service.getAdminSummary(Role.USER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(prismaMock.evidenceAttachment.count).not.toHaveBeenCalled();
  });

  it('returns admin review queue defaulting to pending review', async () => {
    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceAttachmentMock,
    ]);
    prismaMock.evidenceAttachment.count.mockResolvedValue(1);

    const result = await service.listAdminReviewQueue(Role.ADMIN, {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      limit: 10,
      offset: 0,
    });

    expect(prismaMock.evidenceAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: EvidenceAttachmentStatus.PENDING_REVIEW,
          targetType: EvidenceAttachmentObjectType.PACKAGE,
        }),
        take: 10,
        skip: 0,
      }),
    );

    expect(result.total).toBe(1);
    expect(result.filters.status).toBe(EvidenceAttachmentStatus.PENDING_REVIEW);
  });

  it('rejects admin review queue for non-admin', async () => {
    await expect(
      service.listAdminReviewQueue(Role.USER, {
        limit: 10,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.evidenceAttachment.findMany).not.toHaveBeenCalled();
  });
});