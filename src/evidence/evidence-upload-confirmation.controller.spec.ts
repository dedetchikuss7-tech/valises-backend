import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentType,
  Role,
} from '@prisma/client';
import { EvidenceUploadConfirmationController } from './evidence-upload-confirmation.controller';
import { EvidenceUploadConfirmationService } from './evidence-upload-confirmation.service';

describe('EvidenceUploadConfirmationController', () => {
  let controller: EvidenceUploadConfirmationController;

  const evidenceUploadConfirmationServiceMock = {
    confirmUploadAndCreateAttachment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceUploadConfirmationController],
      providers: [
        {
          provide: EvidenceUploadConfirmationService,
          useValue: evidenceUploadConfirmationServiceMock,
        },
      ],
    }).compile();

    controller = module.get<EvidenceUploadConfirmationController>(
      EvidenceUploadConfirmationController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates upload confirmation with actor id and role', async () => {
    const req = {
      user: {
        userId: 'user-1',
        role: Role.USER,
      },
    };

    const dto = {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
      label: 'Package photo',
      storageKey:
        'pending/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 12345,
    };

    evidenceUploadConfirmationServiceMock.confirmUploadAndCreateAttachment.mockResolvedValue(
      {
        id: 'ev-1',
      },
    );

    const result = await controller.confirmUpload(req, dto);

    expect(
      evidenceUploadConfirmationServiceMock.confirmUploadAndCreateAttachment,
    ).toHaveBeenCalledWith('user-1', Role.USER, dto);
    expect(result.id).toBe('ev-1');
  });

  it('throws UnauthorizedException when user id is missing', () => {
    const req = {
      user: {
        role: Role.USER,
      },
    };

    expect(() =>
      controller.confirmUpload(req, {
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
    ).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when role is missing', () => {
    const req = {
      user: {
        userId: 'user-1',
      },
    };

    expect(() =>
      controller.confirmUpload(req, {
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
    ).toThrow(UnauthorizedException);
  });
});