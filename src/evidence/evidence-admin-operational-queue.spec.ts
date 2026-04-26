import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentType,
  EvidenceAttachmentVisibility,
  Role,
} from '@prisma/client';
import { EvidenceService } from './evidence.service';
import {
  EvidenceRecommendedAction,
  EvidenceReviewPriority,
  EvidenceReviewReason,
  EvidenceStorageCompletenessStatus,
} from './dto/evidence-admin-operational-signals.dto';

describe('Evidence admin operational review queue', () => {
  let service: EvidenceService;

  const now = new Date('2026-04-26T10:00:00.000Z');

  const baseAttachment = {
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
    fileUrl: 'https://mock-storage.local/object/photo.jpg',
    provider: 'MOCK_STORAGE',
    providerUploadId: 'mock-upload:photo',
    storageKey: 'uploaded/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
    objectUrl: 'https://mock-storage.local/object/photo.jpg',
    publicUrl: null,
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 12345,
    rejectionReason: null,
    reviewNotes: null,
    metadata: null,
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-27T11:30:00.000Z'));

    service = new EvidenceService(
      prismaMock as any,
      adminActionAuditServiceMock as any,
      adminTimelineServiceMock as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('adds operational review signals for pending complete evidence', async () => {
    prismaMock.evidenceAttachment.findMany.mockResolvedValue([baseAttachment]);
    prismaMock.evidenceAttachment.count.mockResolvedValue(1);

    const result = await service.listAdminReviewQueue(Role.ADMIN, {
      limit: 20,
      offset: 0,
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'ev-1',
        reviewAgeMinutes: 1530,
        isReviewOverdue: true,
        reviewPriority: EvidenceReviewPriority.HIGH,
        recommendedAction: EvidenceRecommendedAction.PRIORITIZE_REVIEW,
        storageCompletenessStatus: EvidenceStorageCompletenessStatus.COMPLETE,
      }),
    );

    expect(result.items[0].reviewReasons).toEqual(
      expect.arrayContaining([
        EvidenceReviewReason.PENDING_REVIEW,
        EvidenceReviewReason.REVIEW_OVERDUE,
        EvidenceReviewReason.STORAGE_COMPLETE,
      ]),
    );
  });

  it('marks missing storage metadata as high priority and storage incomplete', async () => {
    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      {
        ...baseAttachment,
        id: 'ev-missing-storage',
        fileUrl: '',
        provider: null,
        providerUploadId: null,
        storageKey: null,
        objectUrl: null,
        publicUrl: null,
      },
    ]);
    prismaMock.evidenceAttachment.count.mockResolvedValue(1);

    const result = await service.listAdminReviewQueue(Role.ADMIN, {
      limit: 20,
      offset: 0,
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'ev-missing-storage',
        reviewPriority: EvidenceReviewPriority.HIGH,
        storageCompletenessStatus: EvidenceStorageCompletenessStatus.MISSING,
        recommendedAction: EvidenceRecommendedAction.PRIORITIZE_REVIEW,
      }),
    );

    expect(result.items[0].reviewReasons).toContain(
      EvidenceReviewReason.STORAGE_INCOMPLETE,
    );
  });

  it('marks legacy fileUrl-only evidence as legacy incomplete', async () => {
    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      {
        ...baseAttachment,
        id: 'ev-legacy',
        provider: null,
        providerUploadId: null,
        storageKey: null,
        objectUrl: null,
        publicUrl: null,
        fileUrl: 'https://legacy.example.com/file.jpg',
      },
    ]);
    prismaMock.evidenceAttachment.count.mockResolvedValue(1);

    const result = await service.listAdminReviewQueue(Role.ADMIN, {
      limit: 20,
      offset: 0,
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'ev-legacy',
        storageCompletenessStatus:
          EvidenceStorageCompletenessStatus.LEGACY_FILE_URL_ONLY,
      }),
    );

    expect(result.items[0].reviewReasons).toContain(
      EvidenceReviewReason.STORAGE_INCOMPLETE,
    );
  });

  it('recommends resubmission for rejected evidence', async () => {
    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      {
        ...baseAttachment,
        status: EvidenceAttachmentStatus.REJECTED,
        rejectionReason: 'Blurry image',
      },
    ]);
    prismaMock.evidenceAttachment.count.mockResolvedValue(1);

    const result = await service.listAdminReviewQueue(Role.ADMIN, {
      status: EvidenceAttachmentStatus.REJECTED,
      limit: 20,
      offset: 0,
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        reviewPriority: EvidenceReviewPriority.HIGH,
        recommendedAction: EvidenceRecommendedAction.REQUEST_RESUBMISSION,
      }),
    );

    expect(result.items[0].reviewReasons).toContain(
      EvidenceReviewReason.REJECTED_ATTACHMENT,
    );
  });

  it('recommends no action for accepted evidence', async () => {
    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      {
        ...baseAttachment,
        status: EvidenceAttachmentStatus.ACCEPTED,
      },
    ]);
    prismaMock.evidenceAttachment.count.mockResolvedValue(1);

    const result = await service.listAdminReviewQueue(Role.ADMIN, {
      status: EvidenceAttachmentStatus.ACCEPTED,
      limit: 20,
      offset: 0,
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        reviewPriority: EvidenceReviewPriority.LOW,
        recommendedAction: EvidenceRecommendedAction.NO_ACTION_REQUIRED,
      }),
    );

    expect(result.items[0].reviewReasons).toContain(
      EvidenceReviewReason.ACCEPTED_ATTACHMENT,
    );
  });
});