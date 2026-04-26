import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentType,
  Role,
} from '@prisma/client';
import { EvidenceUploadIntentController } from './evidence-upload-intent.controller';
import { EvidenceUploadIntentService } from './evidence-upload-intent.service';

describe('EvidenceUploadIntentController', () => {
  let controller: EvidenceUploadIntentController;

  const evidenceUploadIntentServiceMock = {
    createUploadIntent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceUploadIntentController],
      providers: [
        {
          provide: EvidenceUploadIntentService,
          useValue: evidenceUploadIntentServiceMock,
        },
      ],
    }).compile();

    controller = module.get<EvidenceUploadIntentController>(
      EvidenceUploadIntentController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates upload intent creation with actor id and role', async () => {
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
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    };

    evidenceUploadIntentServiceMock.createUploadIntent.mockResolvedValue({
      provider: 'MOCK_STORAGE',
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      targetId: 'pkg-1',
      attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
      storageKey: 'pending/evidence/package/pkg-1/photo.jpg',
    });

    const result = await controller.create(req, dto);

    expect(
      evidenceUploadIntentServiceMock.createUploadIntent,
    ).toHaveBeenCalledWith('user-1', Role.USER, dto);
    expect(result.provider).toBe('MOCK_STORAGE');
  });

  it('throws UnauthorizedException when user id is missing', () => {
    const req = {
      user: {
        role: Role.USER,
      },
    };

    expect(() =>
      controller.create(req, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
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
      controller.create(req, {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: 'pkg-1',
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
      }),
    ).toThrow(UnauthorizedException);
  });
});