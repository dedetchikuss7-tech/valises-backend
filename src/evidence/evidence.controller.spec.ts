import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  Role,
} from '@prisma/client';
import { EvidenceAdminController } from './evidence-admin.controller';
import { EvidenceService } from './evidence.service';

describe('EvidenceAdminController', () => {
  let controller: EvidenceAdminController;

  const evidenceServiceMock = {
    getAdminSummary: jest.fn(),
    listAdminReviewQueue: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceAdminController],
      providers: [
        {
          provide: EvidenceService,
          useValue: evidenceServiceMock,
        },
      ],
    }).compile();

    controller = module.get<EvidenceAdminController>(EvidenceAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates summary loading to service with actor role', async () => {
    const req = {
      user: {
        userId: 'admin-1',
        role: Role.ADMIN,
      },
    };

    evidenceServiceMock.getAdminSummary.mockResolvedValue({
      generatedAt: new Date('2026-04-26T10:00:00.000Z'),
      totalAttachments: 3,
      pendingReviewCount: 1,
      acceptedCount: 1,
      rejectedCount: 1,
    });

    const result = await controller.getSummary(req);

    expect(evidenceServiceMock.getAdminSummary).toHaveBeenCalledWith(
      Role.ADMIN,
    );
    expect(result.totalAttachments).toBe(3);
  });

  it('delegates review queue loading to service with actor role and query', async () => {
    const req = {
      user: {
        userId: 'admin-1',
        role: Role.ADMIN,
      },
    };

    const query = {
      status: EvidenceAttachmentStatus.PENDING_REVIEW,
      targetType: EvidenceAttachmentObjectType.PACKAGE,
      limit: 10,
      offset: 0,
    };

    evidenceServiceMock.listAdminReviewQueue.mockResolvedValue({
      items: [],
      total: 0,
      limit: 10,
      offset: 0,
      hasMore: false,
    });

    const result = await controller.listReviewQueue(req, query);

    expect(evidenceServiceMock.listAdminReviewQueue).toHaveBeenCalledWith(
      Role.ADMIN,
      query,
    );
    expect(result.total).toBe(0);
  });

  it('throws UnauthorizedException when role is missing for summary', () => {
    const req = {
      user: {
        userId: 'admin-1',
      },
    };

    expect(() => controller.getSummary(req)).toThrow(UnauthorizedException);
  });
});