import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentType,
  EvidenceAttachmentVisibility,
  Role,
} from '@prisma/client';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

describe('EvidenceController', () => {
  let controller: EvidenceController;

  const evidenceServiceMock = {
    create: jest.fn(),
    list: jest.fn(),
    getOne: jest.fn(),
    review: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceController],
      providers: [
        {
          provide: EvidenceService,
          useValue: evidenceServiceMock,
        },
      ],
    }).compile();

    controller = module.get<EvidenceController>(EvidenceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates evidence creation to service with user id and role', async () => {
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
      visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
      label: 'Package photo',
      fileUrl: 'https://storage.example.com/pkg-1/photo.jpg',
    };

    evidenceServiceMock.create.mockResolvedValue({
      id: 'ev-1',
      ...dto,
      uploadedById: 'user-1',
    });

    const result = await controller.create(req, dto);

    expect(evidenceServiceMock.create).toHaveBeenCalledWith(
      'user-1',
      Role.USER,
      dto,
    );
    expect(result.id).toBe('ev-1');
  });

  it('delegates evidence listing to service with user id and role', async () => {
    const req = {
      user: {
        userId: 'admin-1',
        role: Role.ADMIN,
      },
    };

    const query = {
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      limit: 10,
      offset: 0,
    };

    evidenceServiceMock.list.mockResolvedValue({
      items: [],
      total: 0,
      limit: 10,
      offset: 0,
      hasMore: false,
    });

    const result = await controller.list(req, query);

    expect(evidenceServiceMock.list).toHaveBeenCalledWith(
      'admin-1',
      Role.ADMIN,
      query,
    );
    expect(result.total).toBe(0);
  });

  it('delegates getOne to service with user id and role', async () => {
    const req = {
      user: {
        userId: 'user-1',
        role: Role.USER,
      },
    };

    evidenceServiceMock.getOne.mockResolvedValue({
      id: 'ev-1',
    });

    const result = await controller.getOne(req, 'ev-1');

    expect(evidenceServiceMock.getOne).toHaveBeenCalledWith(
      'user-1',
      Role.USER,
      'ev-1',
    );
    expect(result.id).toBe('ev-1');
  });

  it('delegates review to service with admin id and role', async () => {
    const req = {
      user: {
        userId: 'admin-1',
        role: Role.ADMIN,
      },
    };

    const dto = {
      status: EvidenceAttachmentStatus.ACCEPTED,
      reviewNotes: 'Looks good',
    };

    evidenceServiceMock.review.mockResolvedValue({
      id: 'ev-1',
      status: EvidenceAttachmentStatus.ACCEPTED,
    });

    const result = await controller.review(req, 'ev-1', dto);

    expect(evidenceServiceMock.review).toHaveBeenCalledWith(
      'admin-1',
      Role.ADMIN,
      'ev-1',
      dto,
    );
    expect(result.status).toBe(EvidenceAttachmentStatus.ACCEPTED);
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
        label: 'Package photo',
        fileUrl: 'https://storage.example.com/pkg-1/photo.jpg',
      }),
    ).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when role is missing', () => {
    const req = {
      user: {
        userId: 'user-1',
      },
    };

    expect(() => controller.list(req, {})).toThrow(UnauthorizedException);
  });
});