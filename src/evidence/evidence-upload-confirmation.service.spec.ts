import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentType,
  EvidenceAttachmentVisibility,
  Role,
} from '@prisma/client';
import { EvidenceUploadConfirmationService } from './evidence-upload-confirmation.service';

describe('EvidenceUploadConfirmationService', () => {
  let service: EvidenceUploadConfirmationService;

  const evidenceServiceMock = {
    create: jest.fn(),
  };

  const storageProviderMock = {
    prepareUpload: jest.fn(),
    confirmUpload: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    storageProviderMock.confirmUpload.mockResolvedValue({
      provider: 'MOCK_STORAGE',
      storageKey:
        'uploaded/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
      confirmed: true,
      confirmedAt: '2026-04-26T10:00:00.000Z',
      uploadStatus: 'UPLOADED',
      providerUploadId:
        'mock-upload:uploaded/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
      objectUrl:
        'https://mock-storage.local/object/uploaded%2Fevidence%2Fpackage%2Fpkg-1%2Fpackage_photo%2Fuser-1%2Fphoto.jpg',
      publicUrl: null,
      checksum: null,
    });

    evidenceServiceMock.create.mockResolvedValue({
      id: 'ev-1',
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
      status: 'PENDING_REVIEW',
      provider: 'MOCK_STORAGE',
    });

    service = new EvidenceUploadConfirmationService(
      evidenceServiceMock as any,
      storageProviderMock as any,
    );
  });

  it('confirms upload through storage provider and creates evidence attachment', async () => {
    const result = await service.confirmUploadAndCreateAttachment(
      'user-1',
      Role.USER,
      {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
        label: 'Package photo',
        storageKey:
          'pending/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
        metadata: {
          source: 'mobile',
        },
      },
    );

    expect(storageProviderMock.confirmUpload).toHaveBeenCalledWith({
      storageKey:
        'pending/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
    });

    expect(evidenceServiceMock.create).toHaveBeenCalledWith(
      'user-1',
      Role.USER,
      expect.objectContaining({
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
        label: 'Package photo',
        provider: 'MOCK_STORAGE',
        providerUploadId:
          'mock-upload:uploaded/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
        storageKey:
          'uploaded/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
        objectUrl:
          'https://mock-storage.local/object/uploaded%2Fevidence%2Fpackage%2Fpkg-1%2Fpackage_photo%2Fuser-1%2Fphoto.jpg',
        publicUrl: undefined,
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
        metadata: expect.objectContaining({
          source: 'mobile',
          uploadConfirmation: expect.objectContaining({
            confirmed: true,
            confirmedAt: '2026-04-26T10:00:00.000Z',
            uploadStatus: 'UPLOADED',
            checksum: null,
          }),
        }),
      }),
    );

    expect(result.id).toBe('ev-1');
  });

  it('propagates storage provider errors and does not create evidence attachment', async () => {
    storageProviderMock.confirmUpload.mockRejectedValueOnce(
      new Error('Storage unavailable'),
    );

    await expect(
      service.confirmUploadAndCreateAttachment('user-1', Role.USER, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        label: 'Package photo',
        storageKey:
          'pending/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
      }),
    ).rejects.toThrow('Storage unavailable');

    expect(evidenceServiceMock.create).not.toHaveBeenCalled();
  });
});