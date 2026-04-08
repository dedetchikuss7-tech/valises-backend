import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DisputeCaseNote,
  DisputeEvidenceItemStatus,
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

  const storageProviderMock = {
    prepareUpload: jest.fn(),
    confirmUpload: jest.fn(),
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
      storageProviderMock as any,
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
  });

  it('should list disputes with advanced evidence filters and admin summary', async () => {
    prismaMock.dispute.findMany.mockResolvedValue([
      {
        id: 'dp-filter',
        status: DisputeStatus.OPEN,
        openingSource: DisputeOpeningSource.MANUAL,
        initiatedBySide: DisputeInitiatedBySide.SENDER,
        triggeredByRole: DisputeTriggeredByRole.USER,
        evidenceStatus: 'IN_REVIEW',
        adminAssessment: 'Has context',
        resolution: null,
        _count: {
          caseNotes: 2,
        },
        evidenceItems: [
          {
            kind: 'PHOTO',
            status: DisputeEvidenceItemStatus.ACCEPTED,
            reviewedAt: new Date('2026-04-02T12:00:00.000Z'),
            storageKey: 'uploaded/disputes/dp-filter/photo/1-a.jpg',
          },
          {
            kind: 'SCREENSHOT',
            status: DisputeEvidenceItemStatus.REJECTED,
            reviewedAt: new Date('2026-04-03T12:00:00.000Z'),
            storageKey: 'uploaded/disputes/dp-filter/screenshot/2-b.png',
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
      evidenceKind: 'PHOTO' as any,
      evidenceItemStatus: DisputeEvidenceItemStatus.ACCEPTED,
      hasAcceptedEvidence: 'true',
      hasRejectedEvidence: 'true',
    });

    expect(result[0].adminSummary).toEqual({
      noteCount: 2,
      totalEvidenceCount: 2,
      pendingEvidenceCount: 0,
      acceptedEvidenceCount: 1,
      rejectedEvidenceCount: 1,
      hasPendingEvidenceReview: false,
      lastEvidenceReviewedAt: '2026-04-03T12:00:00.000Z',
      evidenceKindCounts: {
        PHOTO: 1,
        SCREENSHOT: 1,
        CHAT_EXPORT: 0,
        TICKET: 0,
        OTHER: 0,
      },
      hasAnyAcceptedEvidence: true,
      hasAnyRejectedEvidence: true,
      hasOnlyRejectedEvidence: false,
      hasUploadReadyPendingItems: false,
      pendingUploadCount: 0,
      uploadedEvidenceCount: 2,
      isEvidencePackActionable: true,
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
        evidenceStatus: 'IN_REVIEW',
        adminAssessment: null,
        resolution: null,
        _count: { caseNotes: 0 },
        evidenceItems: [
          {
            kind: 'PHOTO',
            status: DisputeEvidenceItemStatus.PENDING,
            reviewedAt: null,
            storageKey: 'pending/disputes/dp-pending/photo/1-a.jpg',
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
        evidenceStatus: 'REVIEWED',
        adminAssessment: 'Reviewed',
        resolution: null,
        _count: { caseNotes: 1 },
        evidenceItems: [
          {
            kind: 'PHOTO',
            status: DisputeEvidenceItemStatus.ACCEPTED,
            reviewedAt: new Date('2026-04-03T10:00:00.000Z'),
            storageKey: 'uploaded/disputes/dp-clean/photo/1-a.jpg',
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
  });

  it('should filter disputes by hasPendingUploads=true after enrichment', async () => {
    prismaMock.dispute.findMany.mockResolvedValue([
      {
        id: 'dp-pending-upload',
        status: DisputeStatus.OPEN,
        evidenceStatus: 'IN_REVIEW',
        adminAssessment: 'Pending upload',
        resolution: null,
        _count: { caseNotes: 0 },
        evidenceItems: [
          {
            kind: 'PHOTO',
            status: DisputeEvidenceItemStatus.PENDING,
            reviewedAt: null,
            storageKey: 'pending/disputes/dp-pending-upload/photo/1-a.jpg',
          },
        ],
        transaction: {
          payout: null,
          refund: null,
        },
      },
      {
        id: 'dp-uploaded',
        status: DisputeStatus.OPEN,
        evidenceStatus: 'IN_REVIEW',
        adminAssessment: 'Uploaded',
        resolution: null,
        _count: { caseNotes: 0 },
        evidenceItems: [
          {
            kind: 'PHOTO',
            status: DisputeEvidenceItemStatus.PENDING,
            reviewedAt: null,
            storageKey: 'uploaded/disputes/dp-uploaded/photo/1-a.jpg',
          },
        ],
        transaction: {
          payout: null,
          refund: null,
        },
      },
    ]);

    const result = await service.findAll({
      hasPendingUploads: 'true',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dp-pending-upload');
  });

  it('should get one dispute with enriched evidence lifecycle admin summary', async () => {
    prismaMock.dispute.findUniqueOrThrow.mockResolvedValue({
      id: 'dp1',
      status: DisputeStatus.OPEN,
      evidenceStatus: 'IN_REVIEW',
      adminAssessment: 'Need final decision',
      caseNotes: [],
      evidenceItems: [
        {
          id: 'evi-1',
          kind: 'PHOTO',
          status: DisputeEvidenceItemStatus.PENDING,
          reviewedAt: null,
          storageKey: 'pending/disputes/dp1/photo/1-a.jpg',
          reviewedByAdmin: null,
        },
        {
          id: 'evi-2',
          kind: 'TICKET',
          status: DisputeEvidenceItemStatus.ACCEPTED,
          reviewedAt: new Date('2026-04-04T10:00:00.000Z'),
          storageKey: 'uploaded/disputes/dp1/ticket/2-b.pdf',
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

    expect(result.evidenceItems[0]).toMatchObject({
      id: 'evi-1',
      isUploadPending: true,
      isUploaded: false,
      uploadConfirmedAt: null,
    });

    expect(result.evidenceItems[1]).toMatchObject({
      id: 'evi-2',
      isUploadPending: false,
      isUploaded: true,
      uploadConfirmedAt: new Date('2026-04-04T10:00:00.000Z'),
    });

    expect(result.adminSummary).toEqual({
      noteCount: 0,
      totalEvidenceCount: 2,
      pendingEvidenceCount: 1,
      acceptedEvidenceCount: 1,
      rejectedEvidenceCount: 0,
      hasPendingEvidenceReview: true,
      lastEvidenceReviewedAt: '2026-04-04T10:00:00.000Z',
      evidenceKindCounts: {
        PHOTO: 1,
        SCREENSHOT: 0,
        CHAT_EXPORT: 0,
        TICKET: 1,
        OTHER: 0,
      },
      hasAnyAcceptedEvidence: true,
      hasAnyRejectedEvidence: false,
      hasOnlyRejectedEvidence: false,
      hasUploadReadyPendingItems: true,
      pendingUploadCount: 1,
      uploadedEvidenceCount: 1,
      isEvidencePackActionable: false,
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

    expect(result).toEqual(createdNote);
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
      storageKey: 'uploaded/disputes/dp-evi/photo.jpg',
      status: DisputeEvidenceItemStatus.PENDING,
    });

    const result = await service.addEvidenceItem('dp-evi', 'admin1', {
      kind: 'PHOTO' as any,
      label: 'Sender photo',
      storageKey: 'uploaded/disputes/dp-evi/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 12345,
    });

    expect(prismaMock.disputeEvidenceItem.create).toHaveBeenCalledWith({
      data: {
        disputeId: 'dp-evi',
        kind: 'PHOTO',
        label: 'Sender photo',
        storageKey: 'uploaded/disputes/dp-evi/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
        status: DisputeEvidenceItemStatus.PENDING,
      },
    });
    expect(result.id).toBe('evi-1');
  });

  it('should create upload-ready evidence intent with normalized values and storage provider contract', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-upload',
      transactionId: 'tx-upload',
    });

    prismaMock.disputeEvidenceItem.create.mockImplementation(async ({ data }) => ({
      id: 'evi-upload-1',
      ...data,
    }));

    storageProviderMock.prepareUpload.mockResolvedValue({
      provider: 'MOCK_STORAGE',
      storageKey: 'pending/disputes/dp-upload/photo/123-photo-1.jpg',
      uploadUrl:
        'https://mock-storage.local/upload/pending%2Fdisputes%2Fdp-upload%2Fphoto%2F123-photo-1.jpg?token=abc',
      method: 'PUT',
      headers: {
        'content-type': 'image/jpeg',
        'x-mock-upload-token': 'abc',
      },
      expiresInSeconds: 900,
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

    expect(storageProviderMock.prepareUpload).toHaveBeenCalledWith({
      storageKey: expect.stringMatching(
        /^pending\/disputes\/dp-upload\/photo\/\d+-photo-1\.jpg$/,
      ),
      fileName: 'photo-1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 120000,
      kind: 'PHOTO',
    });

    expect(result.evidenceItem.id).toBe('evi-upload-1');
    expect(result.evidenceItem.storageKey).toMatch(
      /^pending\/disputes\/dp-upload\/photo\/\d+-photo-1\.jpg$/,
    );
    expect(result.uploadIntent.uploadStatus).toBe('PENDING_CLIENT_UPLOAD');
  });

  it('should confirm evidence upload and update storageKey', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-confirm',
      transactionId: 'tx-confirm',
    });

    prismaMock.disputeEvidenceItem.findUnique.mockResolvedValue({
      id: 'evi-confirm-1',
      disputeId: 'dp-confirm',
      status: DisputeEvidenceItemStatus.PENDING,
      storageKey: 'pending/disputes/dp-confirm/photo/1-a.jpg',
      sizeBytes: 120000,
    });

    storageProviderMock.confirmUpload.mockResolvedValue({
      provider: 'MOCK_STORAGE',
      storageKey: 'uploaded/disputes/dp-confirm/photo/1-a.jpg',
      confirmed: true,
      confirmedAt: '2026-04-06T12:00:00.000Z',
    });

    prismaMock.disputeEvidenceItem.update.mockResolvedValue({
      id: 'evi-confirm-1',
      disputeId: 'dp-confirm',
      status: DisputeEvidenceItemStatus.PENDING,
      storageKey: 'uploaded/disputes/dp-confirm/photo/1-a.jpg',
      sizeBytes: 120000,
    });

    const result = await service.confirmEvidenceUpload(
      'dp-confirm',
      'evi-confirm-1',
      'admin1',
      {
        uploadedSizeBytes: 120000,
      } as any,
    );

    expect(storageProviderMock.confirmUpload).toHaveBeenCalledWith({
      storageKey: 'pending/disputes/dp-confirm/photo/1-a.jpg',
    });

    expect(result.uploadConfirmation.storageKey).toBe(
      'uploaded/disputes/dp-confirm/photo/1-a.jpg',
    );
  });

  it('should reject confirm upload when storageKey is not pending', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-confirm',
      transactionId: 'tx-confirm',
    });

    prismaMock.disputeEvidenceItem.findUnique.mockResolvedValue({
      id: 'evi-confirm-2',
      disputeId: 'dp-confirm',
      status: DisputeEvidenceItemStatus.PENDING,
      storageKey: 'uploaded/disputes/dp-confirm/photo/2-b.jpg',
      sizeBytes: 120000,
    });

    await expect(
      service.confirmEvidenceUpload(
        'dp-confirm',
        'evi-confirm-2',
        'admin1',
        {
          uploadedSizeBytes: 120000,
        } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reset evidence review back to pending', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-reset',
      transactionId: 'tx-reset',
    });

    prismaMock.disputeEvidenceItem.findUnique.mockResolvedValue({
      id: 'evi-reset-1',
      disputeId: 'dp-reset',
      status: DisputeEvidenceItemStatus.REJECTED,
      storageKey: 'uploaded/disputes/dp-reset/photo/1-a.jpg',
      sizeBytes: 120000,
    });

    prismaMock.disputeEvidenceItem.update.mockResolvedValue({
      id: 'evi-reset-1',
      disputeId: 'dp-reset',
      status: DisputeEvidenceItemStatus.PENDING,
      reviewedByAdminId: null,
      reviewedAt: null,
      rejectionReason: null,
    });

    const result = await service.resetEvidenceItemReview(
      'dp-reset',
      'evi-reset-1',
      'admin1',
      {
        reason: 'Need another review pass',
      },
    );

    expect(result.status).toBe(DisputeEvidenceItemStatus.PENDING);
  });

  it('should invalidate evidence item with required reason', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-invalidate',
      transactionId: 'tx-invalidate',
    });

    prismaMock.disputeEvidenceItem.findUnique.mockResolvedValue({
      id: 'evi-invalidate-1',
      disputeId: 'dp-invalidate',
      status: DisputeEvidenceItemStatus.PENDING,
      storageKey: 'uploaded/disputes/dp-invalidate/photo/1-a.jpg',
      sizeBytes: 120000,
    });

    prismaMock.disputeEvidenceItem.update.mockResolvedValue({
      id: 'evi-invalidate-1',
      disputeId: 'dp-invalidate',
      status: DisputeEvidenceItemStatus.REJECTED,
      rejectionReason: 'Duplicate or unusable evidence',
    });

    const result = await service.invalidateEvidenceItem(
      'dp-invalidate',
      'evi-invalidate-1',
      'admin1',
      {
        reason: 'Duplicate or unusable evidence',
      },
    );

    expect(result.status).toBe(DisputeEvidenceItemStatus.REJECTED);
  });

  it('should throw when evidence item does not belong to dispute during reset', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-reset',
      transactionId: 'tx-reset',
    });

    prismaMock.disputeEvidenceItem.findUnique.mockResolvedValue({
      id: 'evi-reset-2',
      disputeId: 'other-dispute',
      status: DisputeEvidenceItemStatus.ACCEPTED,
      storageKey: 'uploaded/disputes/other/photo/1-a.jpg',
      sizeBytes: 120000,
    });

    await expect(
      service.resetEvidenceItemReview('dp-reset', 'evi-reset-2', 'admin1', {}),
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
      status: DisputeEvidenceItemStatus.PENDING,
      storageKey: 'uploaded/disputes/dp-review/photo/1-a.jpg',
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

    expect(result.status).toBe(DisputeEvidenceItemStatus.ACCEPTED);
  });

  it('should reject review when upload is still pending', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp-review',
      transactionId: 'tx-review',
    });

    prismaMock.disputeEvidenceItem.findUnique.mockResolvedValue({
      id: 'evi-1',
      disputeId: 'dp-review',
      status: DisputeEvidenceItemStatus.PENDING,
      storageKey: 'pending/disputes/dp-review/photo/1-a.jpg',
    });

    await expect(
      service.reviewEvidenceItem('dp-review', 'evi-1', 'admin1', {
        status: DisputeEvidenceItemStatus.ACCEPTED,
      }),
    ).rejects.toThrow(BadRequestException);
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