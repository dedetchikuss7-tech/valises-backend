import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentType,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { EvidenceUploadIntentService } from './evidence-upload-intent.service';

describe('EvidenceUploadIntentService', () => {
  let service: EvidenceUploadIntentService;

  const prismaMock = {
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

  const storageProviderMock = {
    prepareUpload: jest.fn(),
    confirmUpload: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    storageProviderMock.prepareUpload.mockResolvedValue({
      provider: 'MOCK_STORAGE',
      storageKey:
        'pending/evidence/package/pkg-1/package_photo/sender-1/file.jpg',
      uploadUrl:
        'https://mock-storage.local/upload/pending%2Fevidence%2Fpackage%2Fpkg-1%2Fpackage-photo%2Fsender-1%2Ffile.jpg?token=abc',
      method: 'PUT',
      headers: {
        'content-type': 'image/jpeg',
        'x-mock-upload-token': 'abc',
      },
      expiresInSeconds: 900,
      uploadStatus: 'PENDING_CLIENT_UPLOAD',
      providerUploadId:
        'mock-upload:pending/evidence/package/pkg-1/package_photo/sender-1/file.jpg',
      objectUrl:
        'https://mock-storage.local/object/pending%2Fevidence%2Fpackage%2Fpkg-1%2Fpackage-photo%2Fsender-1%2Ffile.jpg',
      publicUrl: null,
      maxAllowedSizeBytes: 1000,
    });

    service = new EvidenceUploadIntentService(
      prismaMock as any,
      storageProviderMock as any,
    );
  });

  it('creates upload intent for package owner using existing storage provider', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
    });

    const result = await service.createUploadIntent('sender-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
      fileName: 'front photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    });

    expect(prismaMock.package.findUnique).toHaveBeenCalledWith({
      where: { id: 'pkg-1' },
      select: {
        id: true,
        senderId: true,
      },
    });

    expect(storageProviderMock.prepareUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        storageKey: expect.stringContaining(
          'pending/evidence/package/pkg-1/package_photo/sender-1/',
        ),
        fileName: 'front photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
        kind: 'EVIDENCE_PACKAGE_PHOTO',
      }),
    );

    expect(result.provider).toBe('MOCK_STORAGE');
    expect(result.targetType).toBe(EvidenceAttachmentObjectType.PACKAGE);
    expect(result.targetId).toBe('pkg-1');
    expect(result.attachmentType).toBe(EvidenceAttachmentType.PACKAGE_PHOTO);
    expect(result.fileName).toBe('front photo.jpg');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.sizeBytes).toBe(1000);
    expect(result.uploadStatus).toBe('PENDING_CLIENT_UPLOAD');
    expect(result.allowedMimeTypes).toContain('image/jpeg');
    expect(result.nextStep).toContain('Upload the file');
  });

  it('normalizes mime type before calling storage provider', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
    });

    await service.createUploadIntent('sender-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
      fileName: 'photo.jpg',
      mimeType: ' IMAGE/JPEG ',
      sizeBytes: 1000,
    });

    expect(storageProviderMock.prepareUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: 'image/jpeg',
      }),
    );
  });

  it('allows traveler linked to active transaction for package target', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
    });
    prismaMock.transaction.findFirst.mockResolvedValue({
      senderId: 'sender-1',
      travelerId: 'traveler-1',
    });

    await service.createUploadIntent('traveler-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
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
    expect(storageProviderMock.prepareUpload).toHaveBeenCalled();
  });

  it('rejects unsupported mime type', async () => {
    await expect(
      service.createUploadIntent('sender-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        fileName: 'virus.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageProviderMock.prepareUpload).not.toHaveBeenCalled();
  });

  it('rejects oversized file', async () => {
    await expect(
      service.createUploadIntent('sender-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        fileName: 'large.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 11 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageProviderMock.prepareUpload).not.toHaveBeenCalled();
  });

  it('rejects zero file size', async () => {
    await expect(
      service.createUploadIntent('sender-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        fileName: 'empty.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageProviderMock.prepareUpload).not.toHaveBeenCalled();
  });

  it('rejects missing package target', async () => {
    prismaMock.package.findUnique.mockResolvedValue(null);

    await expect(
      service.createUploadIntent('sender-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'missing',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(storageProviderMock.prepareUpload).not.toHaveBeenCalled();
  });

  it('rejects unrelated user for package target', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
    });
    prismaMock.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.createUploadIntent('outsider-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(storageProviderMock.prepareUpload).not.toHaveBeenCalled();
  });

  it('allows transaction party for transaction target', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
    });

    const result = await service.createUploadIntent('sender-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.TRANSACTION,
      targetId: 'tx-1',
      attachmentType: EvidenceAttachmentType.DOCUMENT,
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    });

    expect(prismaMock.transaction.findUnique).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      select: {
        id: true,
        senderId: true,
        travelerId: true,
      },
    });
    expect(result.provider).toBe('MOCK_STORAGE');
  });

  it('rejects unrelated user for transaction target', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
    });

    await expect(
      service.createUploadIntent('outsider-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.TRANSACTION,
        targetId: 'tx-1',
        attachmentType: EvidenceAttachmentType.DOCUMENT,
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(storageProviderMock.prepareUpload).not.toHaveBeenCalled();
  });

  it('allows dispute party for dispute target', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'disp-1',
      openedById: 'sender-1',
      transaction: {
        senderId: 'sender-1',
        travelerId: 'traveler-1',
      },
    });

    const result = await service.createUploadIntent('traveler-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.DISPUTE,
      targetId: 'disp-1',
      attachmentType: EvidenceAttachmentType.DISPUTE_EVIDENCE,
      fileName: 'evidence.png',
      mimeType: 'image/png',
      sizeBytes: 1000,
    });

    expect(result.provider).toBe('MOCK_STORAGE');
    expect(storageProviderMock.prepareUpload).toHaveBeenCalled();
  });

  it('allows payout party for payout target', async () => {
    prismaMock.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      transaction: {
        senderId: 'sender-1',
        travelerId: 'traveler-1',
      },
    });

    const result = await service.createUploadIntent('traveler-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.PAYOUT,
      targetId: 'payout-1',
      attachmentType: EvidenceAttachmentType.DOCUMENT,
      fileName: 'payout.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    });

    expect(result.provider).toBe('MOCK_STORAGE');
  });

  it('allows refund party for refund target', async () => {
    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'refund-1',
      transaction: {
        senderId: 'sender-1',
        travelerId: 'traveler-1',
      },
    });

    const result = await service.createUploadIntent('sender-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.REFUND,
      targetId: 'refund-1',
      attachmentType: EvidenceAttachmentType.DOCUMENT,
      fileName: 'refund.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    });

    expect(result.provider).toBe('MOCK_STORAGE');
  });

  it('allows KYC owner for KYC target', async () => {
    prismaMock.kycVerification.findUnique.mockResolvedValue({
      id: 'kyc-1',
      userId: 'user-1',
    });

    const result = await service.createUploadIntent('user-1', Role.USER, {
      targetType: EvidenceAttachmentObjectType.KYC,
      targetId: 'kyc-1',
      attachmentType: EvidenceAttachmentType.DOCUMENT,
      fileName: 'kyc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    });

    expect(result.provider).toBe('MOCK_STORAGE');
  });

  it('rejects non-admin for admin-only target type', async () => {
    await expect(
      service.createUploadIntent('user-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.ADMIN_CASE,
        targetId: 'case-1',
        attachmentType: EvidenceAttachmentType.ADMIN_NOTE_ATTACHMENT,
        fileName: 'admin-note.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(storageProviderMock.prepareUpload).not.toHaveBeenCalled();
  });

  it('allows admin for existing transaction target', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
    });

    const result = await service.createUploadIntent('admin-1', Role.ADMIN, {
      targetType: EvidenceAttachmentObjectType.TRANSACTION,
      targetId: 'tx-1',
      attachmentType: EvidenceAttachmentType.DOCUMENT,
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    });

    expect(result.provider).toBe('MOCK_STORAGE');
    expect(storageProviderMock.prepareUpload).toHaveBeenCalled();
  });
});
