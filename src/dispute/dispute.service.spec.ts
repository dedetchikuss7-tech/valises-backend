import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DisputeCaseNote,
  DisputeEvidenceItemStatus,
  DisputeEvidenceStatus,
  DisputeInitiatedBySide,
  DisputeOpeningSource,
  DisputeOutcome,
  DisputeReasonCode,
  DisputeStatus,
  DisputeTriggeredByRole,
  EvidenceLevel,
  PaymentStatus,
  PayoutProvider,
  RefundProvider,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { DisputeService } from './dispute.service';

describe('DisputeService', () => {
  let service: DisputeService;

  const prismaMock = {
    transaction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    dispute: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    disputeResolution: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    disputeCaseNote: {
      create: jest.fn(),
    },
    disputeEvidenceItem: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payout: {
      findUnique: jest.fn(),
    },
    refund: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const ledgerMock = {
    getEscrowBalance: jest.fn(),
  };

  const matrixMock = {
    recommend: jest.fn(),
  };

  const payoutServiceMock = {
    requestPayoutForTransaction: jest.fn(),
  };

  const refundServiceMock = {
    requestRefundForTransaction: jest.fn(),
  };

  const adminActionAuditServiceMock = {
    recordSafe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(async (cb: any) =>
      cb({
        disputeResolution: {
          create: prismaMock.disputeResolution.create,
        },
        dispute: {
          update: prismaMock.dispute.update,
        },
        transaction: {
          update: prismaMock.transaction.update,
        },
      }),
    );

    service = new DisputeService(
      prismaMock as any,
      ledgerMock as any,
      matrixMock as any,
      payoutServiceMock as any,
      refundServiceMock as any,
      adminActionAuditServiceMock as any,
    );
  });

  it('should create dispute and set transaction to DISPUTED', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
    });

    prismaMock.dispute.findFirst.mockResolvedValue(null);

    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DISPUTED,
    });

    prismaMock.dispute.create.mockResolvedValue({
      id: 'dp1',
      transactionId: 'tx1',
      openedById: 'sender1',
      reason: 'Damaged',
      reasonCode: DisputeReasonCode.DAMAGED,
      openingSource: DisputeOpeningSource.MANUAL,
      initiatedBySide: DisputeInitiatedBySide.SENDER,
      triggeredByRole: DisputeTriggeredByRole.USER,
      status: DisputeStatus.OPEN,
    });

    const result = await service.create({
      transactionId: 'tx1',
      openedById: 'sender1',
      reason: 'Damaged',
      reasonCode: DisputeReasonCode.DAMAGED,
      actorRole: Role.USER,
    });

    expect(result.status).toBe(DisputeStatus.OPEN);
    expect(result.openingSource).toBe(DisputeOpeningSource.MANUAL);
    expect(result.initiatedBySide).toBe(DisputeInitiatedBySide.SENDER);
    expect(result.triggeredByRole).toBe(DisputeTriggeredByRole.USER);
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: { status: TransactionStatus.DISPUTED },
    });
    expect(adminActionAuditServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DISPUTE_CREATED',
        targetType: 'DISPUTE',
        targetId: 'dp1',
        actorUserId: 'sender1',
        metadata: expect.objectContaining({
          transactionId: 'tx1',
          openingSource: DisputeOpeningSource.MANUAL,
          initiatedBySide: DisputeInitiatedBySide.SENDER,
          triggeredByRole: DisputeTriggeredByRole.USER,
        }),
      }),
    );
  });

  it('should return existing open dispute instead of creating another one', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
      status: TransactionStatus.DISPUTED,
      paymentStatus: PaymentStatus.SUCCESS,
    });

    prismaMock.dispute.findFirst.mockResolvedValue({
      id: 'dp-existing',
      transactionId: 'tx1',
      openedById: 'sender1',
      reason: 'Damaged',
      reasonCode: DisputeReasonCode.DAMAGED,
      openingSource: DisputeOpeningSource.MANUAL,
      initiatedBySide: DisputeInitiatedBySide.SENDER,
      triggeredByRole: DisputeTriggeredByRole.USER,
      status: DisputeStatus.OPEN,
    });

    const result = await service.create({
      transactionId: 'tx1',
      openedById: 'sender1',
      reason: 'Damaged',
      reasonCode: DisputeReasonCode.DAMAGED,
      actorRole: Role.USER,
    });

    expect(result.id).toBe('dp-existing');
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
    expect(prismaMock.dispute.create).not.toHaveBeenCalled();
  });

  it('should infer traveler manual dispute metadata', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-traveler',
      senderId: 'sender1',
      travelerId: 'traveler1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
    });

    prismaMock.dispute.findFirst.mockResolvedValue(null);

    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx-traveler',
      status: TransactionStatus.DISPUTED,
    });

    prismaMock.dispute.create.mockResolvedValue({
      id: 'dp-traveler',
      transactionId: 'tx-traveler',
      openedById: 'traveler1',
      reason: 'Traveler opened dispute',
      reasonCode: DisputeReasonCode.OTHER,
      openingSource: DisputeOpeningSource.MANUAL,
      initiatedBySide: DisputeInitiatedBySide.TRAVELER,
      triggeredByRole: DisputeTriggeredByRole.USER,
      status: DisputeStatus.OPEN,
    });

    const result = await service.create({
      transactionId: 'tx-traveler',
      openedById: 'traveler1',
      reason: 'Traveler opened dispute',
      actorRole: Role.USER,
    });

    expect(result.initiatedBySide).toBe(DisputeInitiatedBySide.TRAVELER);
    expect(result.triggeredByRole).toBe(DisputeTriggeredByRole.USER);
  });

  it('should keep explicit initiatedBySide and admin triggered role', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-admin',
      senderId: 'sender1',
      travelerId: 'traveler1',
      status: TransactionStatus.DISPUTED,
      paymentStatus: PaymentStatus.SUCCESS,
    });

    prismaMock.dispute.findFirst.mockResolvedValue(null);

    prismaMock.dispute.create.mockResolvedValue({
      id: 'dp-admin',
      transactionId: 'tx-admin',
      openedById: 'admin1',
      reason:
        'Post-departure blocking requested from traveler side. Manual review required.',
      reasonCode: DisputeReasonCode.OTHER,
      openingSource: DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
      initiatedBySide: DisputeInitiatedBySide.TRAVELER,
      triggeredByRole: DisputeTriggeredByRole.ADMIN,
      status: DisputeStatus.OPEN,
    });

    const result = await service.create({
      transactionId: 'tx-admin',
      openedById: 'admin1',
      reason:
        'Post-departure blocking requested from traveler side. Manual review required.',
      openingSource: DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
      initiatedBySide: DisputeInitiatedBySide.TRAVELER,
      actorRole: Role.ADMIN,
    });

    expect(result.openingSource).toBe(
      DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
    );
    expect(result.initiatedBySide).toBe(DisputeInitiatedBySide.TRAVELER);
    expect(result.triggeredByRole).toBe(DisputeTriggeredByRole.ADMIN);
  });

  it('should list disputes with structured filters and admin summary', async () => {
    prismaMock.dispute.findMany.mockResolvedValue([
      {
        id: 'dp-filter',
        status: DisputeStatus.OPEN,
        openingSource: DisputeOpeningSource.MANUAL,
        initiatedBySide: DisputeInitiatedBySide.SENDER,
        triggeredByRole: DisputeTriggeredByRole.USER,
        evidenceStatus: DisputeEvidenceStatus.IN_REVIEW,
        adminAssessment: null,
        resolution: null,
        _count: {
          caseNotes: 2,
        },
        evidenceItems: [
          {
            status: DisputeEvidenceItemStatus.PENDING,
            reviewedAt: null,
          },
          {
            status: DisputeEvidenceItemStatus.ACCEPTED,
            reviewedAt: new Date('2026-04-01T10:00:00.000Z'),
          },
          {
            status: DisputeEvidenceItemStatus.REJECTED,
            reviewedAt: new Date('2026-04-02T12:00:00.000Z'),
          },
        ],
        transaction: {
          payout: null,
          refund: null,
        },
      },
    ]);

    const result = await service.findAll({
      status: DisputeStatus.OPEN,
      openingSource: DisputeOpeningSource.MANUAL,
      initiatedBySide: DisputeInitiatedBySide.SENDER,
      triggeredByRole: DisputeTriggeredByRole.USER,
      transactionId: 'tx-filter',
      reasonCode: DisputeReasonCode.DAMAGED,
      openedById: 'user-1',
      evidenceStatus: DisputeEvidenceStatus.IN_REVIEW,
    });

    expect(prismaMock.dispute.findMany).toHaveBeenCalledWith({
      where: {
        status: DisputeStatus.OPEN,
        openingSource: DisputeOpeningSource.MANUAL,
        initiatedBySide: DisputeInitiatedBySide.SENDER,
        triggeredByRole: DisputeTriggeredByRole.USER,
        evidenceStatus: DisputeEvidenceStatus.IN_REVIEW,
        reasonCode: DisputeReasonCode.DAMAGED,
        transactionId: 'tx-filter',
        openedById: 'user-1',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        resolution: true,
        _count: {
          select: {
            caseNotes: true,
          },
        },
        evidenceItems: {
          select: {
            status: true,
            reviewedAt: true,
          },
        },
        transaction: {
          include: {
            payout: true,
            refund: true,
          },
        },
      },
    });

    expect(result[0].adminSummary).toEqual({
      noteCount: 2,
      totalEvidenceCount: 3,
      pendingEvidenceCount: 1,
      acceptedEvidenceCount: 1,
      rejectedEvidenceCount: 1,
      hasPendingEvidenceReview: true,
      lastEvidenceReviewedAt: '2026-04-02T12:00:00.000Z',
      resolutionExists: false,
      refundStatus: null,
      payoutStatus: null,
      requiresAdminAttention: true,
    });
  });

  it('should filter disputes by hasPendingEvidenceReview=true after enrichment', async () => {
    prismaMock.dispute.findMany.mockResolvedValue([
      {
        id: 'dp-pending',
        status: DisputeStatus.OPEN,
        evidenceStatus: DisputeEvidenceStatus.IN_REVIEW,
        adminAssessment: null,
        resolution: null,
        _count: { caseNotes: 0 },
        evidenceItems: [
          {
            status: DisputeEvidenceItemStatus.PENDING,
            reviewedAt: null,
          },
        ],
        transaction: {
          payout: null,
          refund: null,
        },
      },
      {
        id: 'dp-clean',
        status: DisputeStatus.OPEN,
        evidenceStatus: DisputeEvidenceStatus.REVIEWED,
        adminAssessment: 'Reviewed',
        resolution: null,
        _count: { caseNotes: 1 },
        evidenceItems: [
          {
            status: DisputeEvidenceItemStatus.ACCEPTED,
            reviewedAt: new Date('2026-04-03T10:00:00.000Z'),
          },
        ],
        transaction: {
          payout: null,
          refund: null,
        },
      },
    ]);

    const result = await service.findAll({
      hasPendingEvidenceReview: 'true',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dp-pending');
    expect(result[0].adminSummary.hasPendingEvidenceReview).toBe(true);
  });

  it('should get one dispute with case notes, evidence items, transaction money context and admin summary', async () => {
    prismaMock.dispute.findUniqueOrThrow.mockResolvedValue({
      id: 'dp1',
      status: DisputeStatus.OPEN,
      evidenceStatus: DisputeEvidenceStatus.IN_REVIEW,
      adminAssessment: null,
      caseNotes: [],
      evidenceItems: [
        {
          id: 'evi-1',
          status: DisputeEvidenceItemStatus.PENDING,
          reviewedAt: null,
          reviewedByAdmin: null,
        },
      ],
      transaction: {
        payout: null,
        refund: null,
      },
      resolution: null,
    });

    const result = await service.findOne('dp1');

    expect(prismaMock.dispute.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'dp1' },
      include: {
        resolution: true,
        caseNotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            authorAdmin: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
        },
        evidenceItems: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewedByAdmin: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
        },
        transaction: {
          include: {
            payout: true,
            refund: true,
          },
        },
      },
    });

    expect(result.adminSummary).toEqual({
      noteCount: 0,
      totalEvidenceCount: 1,
      pendingEvidenceCount: 1,
      acceptedEvidenceCount: 0,
      rejectedEvidenceCount: 0,
      hasPendingEvidenceReview: true,
      lastEvidenceReviewedAt: null,
      resolutionExists: false,
      refundStatus: null,
      payoutStatus: null,
      requiresAdminAttention: true,
    });
  });

  it('should add case note and audit admin action', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-note',
      transactionId: 'tx-note',
    });

    const createdNote: Partial<DisputeCaseNote> = {
      id: 'note-1',
      disputeId: 'dp-note',
      authorAdminId: 'admin1',
      note: 'Initial admin note',
    };

    prismaMock.disputeCaseNote.create.mockResolvedValue(createdNote);

    const result = await service.addCaseNote('dp-note', 'admin1', {
      note: 'Initial admin note',
    });

    expect(prismaMock.disputeCaseNote.create).toHaveBeenCalledWith({
      data: {
        disputeId: 'dp-note',
        authorAdminId: 'admin1',
        note: 'Initial admin note',
      },
    });
    expect(result).toEqual(createdNote);
    expect(adminActionAuditServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DISPUTE_CASE_NOTE_ADDED',
        targetType: 'DISPUTE',
        targetId: 'dp-note',
        actorUserId: 'admin1',
        metadata: expect.objectContaining({
          transactionId: 'tx-note',
          disputeCaseNoteId: 'note-1',
        }),
      }),
    );
  });

  it('should throw when adding case note to missing dispute', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue(null);

    await expect(
      service.addCaseNote('missing-dispute', 'admin1', {
        note: 'Missing dispute note',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.disputeCaseNote.create).not.toHaveBeenCalled();
  });

  it('should add evidence item and audit admin action', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-evi',
      transactionId: 'tx-evi',
    });

    prismaMock.disputeEvidenceItem.create.mockResolvedValue({
      id: 'evi-1',
      disputeId: 'dp-evi',
      kind: 'PHOTO',
      label: 'Sender photo',
      storageKey: 'disputes/dp-evi/photo.jpg',
      status: DisputeEvidenceItemStatus.PENDING,
    });

    const result = await service.addEvidenceItem('dp-evi', 'admin1', {
      kind: 'PHOTO' as any,
      label: 'Sender photo',
      storageKey: 'disputes/dp-evi/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 12345,
    });

    expect(prismaMock.disputeEvidenceItem.create).toHaveBeenCalledWith({
      data: {
        disputeId: 'dp-evi',
        kind: 'PHOTO',
        label: 'Sender photo',
        storageKey: 'disputes/dp-evi/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
        status: DisputeEvidenceItemStatus.PENDING,
      },
    });
    expect(result.id).toBe('evi-1');
    expect(adminActionAuditServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DISPUTE_EVIDENCE_ITEM_ADDED',
        targetType: 'DISPUTE',
        targetId: 'dp-evi',
        actorUserId: 'admin1',
        metadata: expect.objectContaining({
          transactionId: 'tx-evi',
          disputeEvidenceItemId: 'evi-1',
          kind: 'PHOTO',
          status: DisputeEvidenceItemStatus.PENDING,
        }),
      }),
    );
  });

  it('should create upload-ready evidence intent with normalized values', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-upload',
      transactionId: 'tx-upload',
    });

    prismaMock.disputeEvidenceItem.create.mockResolvedValue({
      id: 'evi-upload-1',
      disputeId: 'dp-upload',
      kind: 'PHOTO',
      label: 'Sender photo upload',
      storageKey: 'disputes/dp-upload/photo/123-photo1.jpg',
      fileName: 'photo1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 120000,
      status: DisputeEvidenceItemStatus.PENDING,
    });

    const result = await service.createEvidenceUploadIntent(
      'dp-upload',
      'admin1',
      {
        kind: 'PHOTO' as any,
        label: 'Sender photo upload',
        fileName: 'Photo 1.JPG',
        mimeType: 'IMAGE/JPEG',
        sizeBytes: 120000,
      },
    );

    expect(prismaMock.disputeEvidenceItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        disputeId: 'dp-upload',
        kind: 'PHOTO',
        label: 'Sender photo upload',
        fileName: 'photo-1.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 120000,
        status: DisputeEvidenceItemStatus.PENDING,
      }),
    });

    expect(result.evidenceItem.id).toBe('evi-upload-1');
    expect(result.uploadIntent.uploadMode).toBe(
      'DIRECT_UPLOAD_NOT_YET_IMPLEMENTED',
    );
    expect(result.uploadIntent.uploadStatus).toBe('PENDING_CLIENT_UPLOAD');
    expect(result.uploadIntent.constraints.allowedMimeTypes).toContain(
      'image/jpeg',
    );
    expect(result.uploadIntent.constraints.maxSizeBytes).toBe(10485760);
  });

  it('should reject upload-ready evidence intent when mimeType is not allowed', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-upload',
      transactionId: 'tx-upload',
    });

    await expect(
      service.createEvidenceUploadIntent('dp-upload', 'admin1', {
        kind: 'PHOTO' as any,
        label: 'Bad photo upload',
        fileName: 'photo.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 120000,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.disputeEvidenceItem.create).not.toHaveBeenCalled();
  });

  it('should reject upload-ready evidence intent when size exceeds max', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-upload',
      transactionId: 'tx-upload',
    });

    await expect(
      service.createEvidenceUploadIntent('dp-upload', 'admin1', {
        kind: 'PHOTO' as any,
        label: 'Huge photo upload',
        fileName: 'huge.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 11 * 1024 * 1024,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.disputeEvidenceItem.create).not.toHaveBeenCalled();
  });

  it('should throw when adding evidence item to missing dispute', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue(null);

    await expect(
      service.addEvidenceItem('missing-dispute', 'admin1', {
        kind: 'PHOTO' as any,
        label: 'Missing',
        storageKey: 'missing',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should review evidence item as accepted', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-review',
      transactionId: 'tx-review',
    });

    prismaMock.disputeEvidenceItem.findUnique.mockResolvedValue({
      id: 'evi-1',
      disputeId: 'dp-review',
    });

    prismaMock.disputeEvidenceItem.update.mockResolvedValue({
      id: 'evi-1',
      disputeId: 'dp-review',
      status: DisputeEvidenceItemStatus.ACCEPTED,
    });

    const result = await service.reviewEvidenceItem(
      'dp-review',
      'evi-1',
      'admin1',
      {
        status: DisputeEvidenceItemStatus.ACCEPTED,
      },
    );

    expect(prismaMock.disputeEvidenceItem.update).toHaveBeenCalledWith({
      where: { id: 'evi-1' },
      data: {
        status: DisputeEvidenceItemStatus.ACCEPTED,
        reviewedByAdminId: 'admin1',
        reviewedAt: expect.any(Date),
        rejectionReason: null,
      },
    });
    expect(result.status).toBe(DisputeEvidenceItemStatus.ACCEPTED);
    expect(adminActionAuditServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DISPUTE_EVIDENCE_ITEM_REVIEWED',
        targetType: 'DISPUTE',
        targetId: 'dp-review',
        actorUserId: 'admin1',
        metadata: expect.objectContaining({
          transactionId: 'tx-review',
          disputeEvidenceItemId: 'evi-1',
          status: DisputeEvidenceItemStatus.ACCEPTED,
          rejectionReason: null,
        }),
      }),
    );
  });

  it('should review evidence item as rejected with reason', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-review',
      transactionId: 'tx-review',
    });

    prismaMock.disputeEvidenceItem.findUnique.mockResolvedValue({
      id: 'evi-2',
      disputeId: 'dp-review',
    });

    prismaMock.disputeEvidenceItem.update.mockResolvedValue({
      id: 'evi-2',
      disputeId: 'dp-review',
      status: DisputeEvidenceItemStatus.REJECTED,
      rejectionReason: 'Blurry image',
    });

    const result = await service.reviewEvidenceItem(
      'dp-review',
      'evi-2',
      'admin1',
      {
        status: DisputeEvidenceItemStatus.REJECTED,
        rejectionReason: 'Blurry image',
      },
    );

    expect(result.status).toBe(DisputeEvidenceItemStatus.REJECTED);
    expect(result.rejectionReason).toBe('Blurry image');
  });

  it('should reject evidence review when rejection reason is missing', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-review',
      transactionId: 'tx-review',
    });

    prismaMock.disputeEvidenceItem.findUnique.mockResolvedValue({
      id: 'evi-3',
      disputeId: 'dp-review',
    });

    await expect(
      service.reviewEvidenceItem('dp-review', 'evi-3', 'admin1', {
        status: DisputeEvidenceItemStatus.REJECTED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject evidence review when evidence item does not belong to dispute', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-review',
      transactionId: 'tx-review',
    });

    prismaMock.disputeEvidenceItem.findUnique.mockResolvedValue({
      id: 'evi-4',
      disputeId: 'other-dispute',
    });

    await expect(
      service.reviewEvidenceItem('dp-review', 'evi-4', 'admin1', {
        status: DisputeEvidenceItemStatus.ACCEPTED,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update admin dossier and audit updated fields', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-dossier',
      transactionId: 'tx-dossier',
    });

    prismaMock.dispute.update.mockResolvedValue({
      id: 'dp-dossier',
      customerStatement: 'Customer says item damaged',
      travelerStatement: 'Traveler denies issue',
      evidenceSummary: 'Photos reviewed',
      adminAssessment: 'Needs split decision',
      evidenceStatus: DisputeEvidenceStatus.IN_REVIEW,
    });

    const result = await service.updateAdminDossier('dp-dossier', 'admin1', {
      customerStatement: 'Customer says item damaged',
      travelerStatement: 'Traveler denies issue',
      evidenceSummary: 'Photos reviewed',
      adminAssessment: 'Needs split decision',
      evidenceStatus: DisputeEvidenceStatus.IN_REVIEW,
    });

    expect(prismaMock.dispute.update).toHaveBeenCalledWith({
      where: { id: 'dp-dossier' },
      data: {
        customerStatement: 'Customer says item damaged',
        travelerStatement: 'Traveler denies issue',
        evidenceSummary: 'Photos reviewed',
        adminAssessment: 'Needs split decision',
        evidenceStatus: DisputeEvidenceStatus.IN_REVIEW,
      },
    });
    expect(result.evidenceStatus).toBe(DisputeEvidenceStatus.IN_REVIEW);
    expect(adminActionAuditServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DISPUTE_ADMIN_DOSSIER_UPDATED',
        targetType: 'DISPUTE',
        targetId: 'dp-dossier',
        actorUserId: 'admin1',
        metadata: expect.objectContaining({
          transactionId: 'tx-dossier',
          updatedFields: {
            customerStatement: true,
            travelerStatement: true,
            evidenceSummary: true,
            adminAssessment: true,
            evidenceStatus: DisputeEvidenceStatus.IN_REVIEW,
          },
        }),
      }),
    );
  });

  it('should support partial admin dossier update', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-dossier-2',
      transactionId: 'tx-dossier-2',
    });

    prismaMock.dispute.update.mockResolvedValue({
      id: 'dp-dossier-2',
      evidenceSummary: 'Only summary updated',
    });

    await service.updateAdminDossier('dp-dossier-2', 'admin1', {
      evidenceSummary: 'Only summary updated',
    });

    expect(prismaMock.dispute.update).toHaveBeenCalledWith({
      where: { id: 'dp-dossier-2' },
      data: {
        evidenceSummary: 'Only summary updated',
      },
    });
  });

  it('should throw when updating admin dossier for missing dispute', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue(null);

    await expect(
      service.updateAdminDossier('missing-dispute', 'admin1', {
        evidenceSummary: 'Will fail',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.dispute.update).not.toHaveBeenCalled();
  });

  it('should get recommendation for dispute', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp1',
      transactionId: 'tx1',
      reasonCode: DisputeReasonCode.DAMAGED,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      transaction: {
        id: 'tx1',
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: new Date('2026-03-14T11:30:00.000Z'),
        updatedAt: new Date('2026-03-14T11:00:00.000Z'),
      },
    });

    matrixMock.recommend.mockReturnValue({
      matrixVersion: 'v1',
      recommendedOutcome: DisputeOutcome.REFUND_SENDER,
      recommendationNotes: 'Strong evidence',
    });

    const result = await service.getRecommendation('dp1', {
      evidenceLevel: EvidenceLevel.STRONG,
    });

    expect(result.disputeId).toBe('dp1');
    expect(result.recommendedOutcome).toBe(DisputeOutcome.REFUND_SENDER);
  });

  it('should resolve dispute with refund orchestration', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp1',
      transactionId: 'tx1',
      reasonCode: DisputeReasonCode.DAMAGED,
      status: DisputeStatus.OPEN,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      transaction: {
        id: 'tx1',
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: new Date('2026-03-14T11:30:00.000Z'),
        updatedAt: new Date('2026-03-14T11:00:00.000Z'),
        payout: null,
        refund: null,
      },
      resolution: null,
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(1000);

    matrixMock.recommend.mockReturnValue({
      matrixVersion: 'v1',
      recommendedOutcome: DisputeOutcome.REFUND_SENDER,
      recommendationNotes: 'Refund',
    });

    prismaMock.disputeResolution.findUnique.mockResolvedValue(null);

    prismaMock.disputeResolution.create.mockResolvedValue({
      id: 'dr1',
      disputeId: 'dp1',
      transactionId: 'tx1',
      outcome: DisputeOutcome.REFUND_SENDER,
      refundAmount: 1000,
      releaseAmount: 0,
      idempotencyKey: 'dispute_resolve:dp1',
    });

    prismaMock.dispute.update.mockResolvedValue({
      id: 'dp1',
      status: DisputeStatus.RESOLVED,
    });

    refundServiceMock.requestRefundForTransaction.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      amount: 1000,
      provider: RefundProvider.MANUAL,
      status: 'REQUESTED',
    });

    const result = await service.resolve('dp1', {
      decidedById: 'admin1',
      outcome: DisputeOutcome.REFUND_SENDER,
      evidenceLevel: EvidenceLevel.STRONG,
    });

    expect(result.resolution.outcome).toBe(DisputeOutcome.REFUND_SENDER);
    expect(result.refund).not.toBeNull();
    expect(result.payout).toBeNull();
    expect(refundServiceMock.requestRefundForTransaction).toHaveBeenCalledWith(
      'tx1',
      1000,
      RefundProvider.MANUAL,
    );
  });

  it('should resolve dispute with release orchestration', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp2',
      transactionId: 'tx2',
      reasonCode: DisputeReasonCode.NO_SHOW_SENDER,
      status: DisputeStatus.OPEN,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      transaction: {
        id: 'tx2',
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: new Date('2026-03-14T11:30:00.000Z'),
        updatedAt: new Date('2026-03-14T11:00:00.000Z'),
        payout: null,
        refund: null,
      },
      resolution: null,
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(800);

    matrixMock.recommend.mockReturnValue({
      matrixVersion: 'v1',
      recommendedOutcome: DisputeOutcome.RELEASE_TO_TRAVELER,
      recommendationNotes: 'Release',
    });

    prismaMock.disputeResolution.findUnique.mockResolvedValue(null);

    prismaMock.disputeResolution.create.mockResolvedValue({
      id: 'dr2',
      disputeId: 'dp2',
      transactionId: 'tx2',
      outcome: DisputeOutcome.RELEASE_TO_TRAVELER,
      refundAmount: 0,
      releaseAmount: 800,
      idempotencyKey: 'dispute_resolve:dp2',
    });

    prismaMock.dispute.update.mockResolvedValue({
      id: 'dp2',
      status: DisputeStatus.RESOLVED,
    });

    payoutServiceMock.requestPayoutForTransaction.mockResolvedValue({
      id: 'po2',
      transactionId: 'tx2',
      amount: 800,
      provider: PayoutProvider.MANUAL,
      status: 'REQUESTED',
    });

    const result = await service.resolve('dp2', {
      decidedById: 'admin1',
      outcome: DisputeOutcome.RELEASE_TO_TRAVELER,
      evidenceLevel: EvidenceLevel.STRONG,
    });

    expect(result.resolution.outcome).toBe(
      DisputeOutcome.RELEASE_TO_TRAVELER,
    );
    expect(result.refund).toBeNull();
    expect(result.payout).not.toBeNull();
    expect(payoutServiceMock.requestPayoutForTransaction).toHaveBeenCalledWith(
      'tx2',
      PayoutProvider.MANUAL,
    );
  });

  it('should resolve dispute with split orchestration', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp3',
      transactionId: 'tx3',
      reasonCode: DisputeReasonCode.DAMAGED,
      status: DisputeStatus.OPEN,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      transaction: {
        id: 'tx3',
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: new Date('2026-03-14T11:30:00.000Z'),
        updatedAt: new Date('2026-03-14T11:00:00.000Z'),
        payout: null,
        refund: null,
      },
      resolution: null,
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(1000);

    matrixMock.recommend.mockReturnValue({
      matrixVersion: 'v1',
      recommendedOutcome: DisputeOutcome.SPLIT,
      recommendationNotes: 'Split',
    });

    prismaMock.disputeResolution.findUnique.mockResolvedValue(null);

    prismaMock.disputeResolution.create.mockResolvedValue({
      id: 'dr3',
      disputeId: 'dp3',
      transactionId: 'tx3',
      outcome: DisputeOutcome.SPLIT,
      refundAmount: 500,
      releaseAmount: 500,
      idempotencyKey: 'dispute_resolve:dp3',
    });

    prismaMock.dispute.update.mockResolvedValue({
      id: 'dp3',
      status: DisputeStatus.RESOLVED,
    });

    refundServiceMock.requestRefundForTransaction.mockResolvedValue({
      id: 'rf3',
      transactionId: 'tx3',
      amount: 500,
      provider: RefundProvider.MANUAL,
      status: 'REQUESTED',
    });

    payoutServiceMock.requestPayoutForTransaction.mockResolvedValue({
      id: 'po3',
      transactionId: 'tx3',
      amount: 500,
      provider: PayoutProvider.MANUAL,
      status: 'REQUESTED',
    });

    const result = await service.resolve('dp3', {
      decidedById: 'admin1',
      outcome: DisputeOutcome.SPLIT,
      evidenceLevel: EvidenceLevel.STRONG,
    });

    expect(result.resolution.outcome).toBe(DisputeOutcome.SPLIT);
    expect(result.refund).not.toBeNull();
    expect(result.payout).not.toBeNull();
  });

  it('should reject resolve if amounts exceed escrow', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp4',
      transactionId: 'tx4',
      reasonCode: DisputeReasonCode.DAMAGED,
      status: DisputeStatus.OPEN,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      transaction: {
        id: 'tx4',
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: new Date('2026-03-14T11:30:00.000Z'),
        updatedAt: new Date('2026-03-14T11:00:00.000Z'),
        payout: null,
        refund: null,
      },
      resolution: null,
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(1000);

    matrixMock.recommend.mockReturnValue({
      matrixVersion: 'v1',
      recommendedOutcome: DisputeOutcome.SPLIT,
      recommendationNotes: 'Split',
    });

    prismaMock.disputeResolution.findUnique.mockResolvedValue(null);

    await expect(
      service.resolve('dp4', {
        decidedById: 'admin1',
        outcome: DisputeOutcome.SPLIT,
        evidenceLevel: EvidenceLevel.STRONG,
        refundAmount: 700,
        releaseAmount: 400,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});