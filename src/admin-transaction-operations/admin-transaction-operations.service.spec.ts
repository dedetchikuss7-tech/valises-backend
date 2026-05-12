import { NotFoundException } from '@nestjs/common';
import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  DisputeReasonCode,
  DisputeStatus,
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentType,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { AdminTransactionOperationsService } from './admin-transaction-operations.service';
import {
  TransactionOperationalSeverity,
  TransactionRecommendedAction,
} from './dto/admin-transaction-operation-item.dto';
import { AdminTransactionOperationalPriority } from './dto/update-admin-transaction-operational-case.dto';

describe('AdminTransactionOperationsService', () => {
  let service: AdminTransactionOperationsService;

  const prismaMock = {
    transaction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    evidenceAttachment: {
      findMany: jest.fn(),
    },
    behaviorRestriction: {
      findMany: jest.fn(),
    },
    adminOwnership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    adminActionAudit: {
      create: jest.fn(),
    },
    adminTimelineEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.adminOwnership.findMany.mockResolvedValue([]);
    prismaMock.adminOwnership.findUnique.mockResolvedValue(null);
    prismaMock.adminOwnership.create.mockResolvedValue({});
    prismaMock.adminOwnership.update.mockResolvedValue({});

    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'audit1' });
    prismaMock.adminTimelineEvent.create.mockResolvedValue({ id: 'timeline1' });

    service = new AdminTransactionOperationsService(prismaMock as any);
  });

  it('returns queue rows with high severity for open dispute and evidence review', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({
        id: 'tx1',
        disputes: [
          {
            id: 'dp1',
            status: DisputeStatus.OPEN,
            createdAt: new Date('2099-01-01T00:00:00.000Z'),
          },
        ],
        payout: { id: 'po1', status: PayoutStatus.REQUESTED },
      }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceRow({
        targetType: EvidenceAttachmentObjectType.DISPUTE,
        targetId: 'dp1',
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
      }),
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listQueue({ limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.items[0].hasOpenDispute).toBe(true);
    expect(result.items[0].hasPendingEvidenceReview).toBe(true);
    expect(result.items[0].hasPendingDisputeEvidenceReview).toBe(true);
    expect(result.items[0].operationalSeverity).toBe(
      TransactionOperationalSeverity.HIGH,
    );
    expect(result.items[0].recommendedAction).toBe(
      TransactionRecommendedAction.REVIEW_DISPUTE_AND_EVIDENCE,
    );
  });

  it('detects pending delivery evidence and recommends delivery proof review', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({
        id: 'tx-delivery',
        status: TransactionStatus.DELIVERED,
      }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceRow({
        targetType: EvidenceAttachmentObjectType.DELIVERY,
        targetId: 'tx-delivery',
        attachmentType: EvidenceAttachmentType.DELIVERY_PROOF,
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
      }),
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listQueue({ limit: 20, offset: 0 });

    expect(result.items[0].hasPendingDeliveryEvidenceReview).toBe(true);
    expect(result.items[0].latestDeliveryProofStatus).toBe(
      EvidenceAttachmentStatus.PENDING_REVIEW,
    );
    expect(result.items[0].recommendedAction).toBe(
      TransactionRecommendedAction.REVIEW_DELIVERY_PROOF,
    );
  });

  it('detects rejected delivery proof as high severity escalation', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({
        id: 'tx-rejected-proof',
        status: TransactionStatus.DELIVERED,
      }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceRow({
        targetType: EvidenceAttachmentObjectType.DELIVERY,
        targetId: 'tx-rejected-proof',
        attachmentType: EvidenceAttachmentType.DELIVERY_PROOF,
        status: EvidenceAttachmentStatus.REJECTED,
      }),
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listQueue({ limit: 20, offset: 0 });

    expect(result.items[0].hasRejectedDeliveryProof).toBe(true);
    expect(result.items[0].operationalSeverity).toBe(
      TransactionOperationalSeverity.HIGH,
    );
    expect(result.items[0].requiresEscalation).toBe(true);
    expect(result.items[0].reasons).toContain('REJECTED_DELIVERY_PROOF');
    expect(result.items[0].escalationReasons).toContain(
      'REJECTED_DELIVERY_PROOF',
    );
  });

  it('detects active user restriction on sender or traveler', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({
        id: 'tx2',
        senderId: 'sender-restricted',
      }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([]);
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([
      {
        userId: 'sender-restricted',
        status: BehaviorRestrictionStatus.ACTIVE,
      },
    ]);

    const result = await service.listQueue({ limit: 20, offset: 0 });

    expect(result.items[0].hasActiveRestriction).toBe(true);
    expect(result.items[0].reasons).toContain('ACTIVE_USER_RESTRICTION');
  });

  it('filters by requiresAdminAttention', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({
        id: 'tx-clean',
      }),
      transactionRow({
        id: 'tx-refund',
        refund: { id: 'rf1', status: RefundStatus.REQUESTED },
      }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([]);
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listQueue({
      requiresAdminAttention: true,
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].transactionId).toBe('tx-refund');
  });

  it('filters by delivery evidence review flag', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({ id: 'tx-clean' }),
      transactionRow({ id: 'tx-delivery' }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceRow({
        targetType: EvidenceAttachmentObjectType.DELIVERY,
        targetId: 'tx-delivery',
        attachmentType: EvidenceAttachmentType.DELIVERY_PROOF,
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
      }),
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listQueue({
      hasPendingDeliveryEvidenceReview: true,
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].transactionId).toBe('tx-delivery');
  });

  it('returns summary counts with delivery evidence signals', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({
        id: 'tx1',
        disputes: [
          {
            id: 'dp1',
            status: DisputeStatus.OPEN,
            createdAt: new Date('2099-01-01T00:00:00.000Z'),
          },
        ],
      }),
      transactionRow({
        id: 'tx2',
        payout: { id: 'po1', status: PayoutStatus.PROCESSING },
      }),
      transactionRow({
        id: 'tx3',
        status: TransactionStatus.DELIVERED,
      }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceRow({
        targetType: EvidenceAttachmentObjectType.DELIVERY,
        targetId: 'tx3',
        attachmentType: EvidenceAttachmentType.DELIVERY_PROOF,
        status: EvidenceAttachmentStatus.REJECTED,
      }),
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.getSummary();

    expect(result.totalRows).toBe(3);
    expect(result.highSeverityCount).toBe(1);
    expect(result.pendingPayoutCount).toBe(1);
    expect(result.rejectedDeliveryProofCount).toBe(1);
    expect(result.requiresEscalationCount).toBe(1);
  });

  it('returns transaction operational drilldown', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      transactionDetailRow({
        id: 'tx-detail',
        disputes: [
          {
            id: 'dp1',
            status: DisputeStatus.OPEN,
            reason: 'Damaged item',
            reasonCode: DisputeReasonCode.DAMAGED,
            openedById: 'sender1',
            createdAt: new Date('2099-01-01T02:00:00.000Z'),
            updatedAt: new Date('2099-01-01T03:00:00.000Z'),
            resolution: null,
          },
        ],
        payout: {
          id: 'po1',
          status: PayoutStatus.REQUESTED,
          provider: 'MANUAL',
          railProvider: null,
          payoutMethodType: null,
          amount: 800,
          currency: 'XAF',
          externalReference: null,
          failureReason: null,
          requestedAt: null,
          processedAt: null,
          paidAt: null,
          updatedAt: new Date('2099-01-01T03:00:00.000Z'),
        },
      }),
    );

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      fullEvidenceRow({
        id: 'ev1',
        targetType: EvidenceAttachmentObjectType.DISPUTE,
        targetId: 'dp1',
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
      }),
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([
      {
        id: 'restriction1',
        userId: 'sender1',
        kind: BehaviorRestrictionKind.WARNING_ONLY,
        scope: BehaviorRestrictionScope.TRANSACTIONS,
        status: BehaviorRestrictionStatus.ACTIVE,
        reasonCode: 'AML_REVIEW_REQUIRED',
        reasonSummary: 'AML review required',
        imposedAt: new Date('2099-01-01T01:00:00.000Z'),
        expiresAt: null,
      },
    ]);

    prismaMock.adminOwnership.findUnique.mockResolvedValue(null);

    const result = await service.getTransactionDetail('tx-detail');

    expect(result.lifecycle.transactionId).toBe('tx-detail');
    expect(result.queueItem.hasOpenDispute).toBe(true);
    expect(result.evidence).toHaveLength(1);
    expect(result.disputes).toHaveLength(1);
    expect(result.payout?.id).toBe('po1');
    expect(result.restrictions).toHaveLength(1);
    expect(result.nextOperationalSteps.length).toBeGreaterThan(0);
  });

  it('throws when transaction detail is not found', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(service.getTransactionDetail('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates an operational case backed by AdminOwnership', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ id: 'tx-case' });
    prismaMock.adminOwnership.findUnique.mockResolvedValue(null);
    prismaMock.adminOwnership.create.mockResolvedValue({
      id: 'ownership1',
      objectType: AdminOwnershipObjectType.TRANSACTION,
      objectId: 'tx-case',
      assignedAdminId: 'admin1',
      claimedAt: new Date('2099-01-01T00:00:00.000Z'),
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.NEW,
      slaDueAt: null,
      completedAt: null,
      metadata: {
        priority: AdminTransactionOperationalPriority.MEDIUM,
        latestActionCode: 'CASE_CREATED',
        latestNote: null,
      },
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await service.getOperationalCase('tx-case', 'admin1');

    expect(result.transactionId).toBe('tx-case');
    expect(result.operationalStatus).toBe(AdminOwnershipOperationalStatus.NEW);
    expect(result.priority).toBe(AdminTransactionOperationalPriority.MEDIUM);
    expect(prismaMock.adminActionAudit.create).toHaveBeenCalled();
    expect(prismaMock.adminTimelineEvent.create).toHaveBeenCalled();
  });

  it('returns existing operational case without recreating it', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ id: 'tx-case' });
    prismaMock.adminOwnership.findUnique.mockResolvedValue({
      id: 'ownership1',
      objectType: AdminOwnershipObjectType.TRANSACTION,
      objectId: 'tx-case',
      assignedAdminId: 'admin1',
      claimedAt: null,
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      slaDueAt: null,
      completedAt: null,
      metadata: {
        priority: AdminTransactionOperationalPriority.HIGH,
        latestActionCode: 'MANUAL_REVIEW_STARTED',
        latestNote: 'Checking evidence',
      },
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await service.getOperationalCase('tx-case', 'admin1');

    expect(result.operationalStatus).toBe(
      AdminOwnershipOperationalStatus.IN_REVIEW,
    );
    expect(result.priority).toBe(AdminTransactionOperationalPriority.HIGH);
    expect(result.latestNote).toBe('Checking evidence');
    expect(prismaMock.adminOwnership.create).not.toHaveBeenCalled();
  });

  it('updates operational case and records audit plus timeline', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ id: 'tx-case' });
    prismaMock.adminOwnership.findUnique.mockResolvedValue({
      id: 'ownership1',
      objectType: AdminOwnershipObjectType.TRANSACTION,
      objectId: 'tx-case',
      assignedAdminId: 'admin1',
      claimedAt: null,
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.NEW,
      slaDueAt: null,
      completedAt: null,
      metadata: {
        priority: AdminTransactionOperationalPriority.MEDIUM,
      },
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T00:00:00.000Z'),
    });
    prismaMock.adminOwnership.update.mockResolvedValue({
      id: 'ownership1',
      objectType: AdminOwnershipObjectType.TRANSACTION,
      objectId: 'tx-case',
      assignedAdminId: 'admin2',
      claimedAt: new Date('2099-01-01T01:00:00.000Z'),
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      slaDueAt: null,
      completedAt: null,
      metadata: {
        priority: AdminTransactionOperationalPriority.HIGH,
        latestActionCode: 'REQUEST_EVIDENCE_RESUBMISSION',
        latestNote: 'Please request clearer delivery proof',
      },
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T01:00:00.000Z'),
    });

    const result = await service.updateOperationalCase('tx-case', 'admin1', {
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      priority: AdminTransactionOperationalPriority.HIGH,
      assignedAdminId: 'admin2',
      actionCode: 'REQUEST_EVIDENCE_RESUBMISSION',
      note: 'Please request clearer delivery proof',
    });

    expect(result.operationalStatus).toBe(
      AdminOwnershipOperationalStatus.IN_REVIEW,
    );
    expect(result.priority).toBe(AdminTransactionOperationalPriority.HIGH);
    expect(result.latestNote).toBe('Please request clearer delivery proof');
    expect(prismaMock.adminOwnership.update).toHaveBeenCalled();
    expect(prismaMock.adminActionAudit.create).toHaveBeenCalled();
    expect(prismaMock.adminTimelineEvent.create).toHaveBeenCalled();
  });
});

function transactionRow(overrides: Partial<any> = {}) {
  const payout =
    overrides.payout === undefined
      ? null
      : overrides.payout === null
        ? null
        : {
            updatedAt: new Date('2099-01-01T01:00:00.000Z'),
            ...overrides.payout,
          };

  const refund =
    overrides.refund === undefined
      ? null
      : overrides.refund === null
        ? null
        : {
            updatedAt: new Date('2099-01-01T01:00:00.000Z'),
            ...overrides.refund,
          };

  return {
    id: 'tx1',
    status: TransactionStatus.PAID,
    paymentStatus: PaymentStatus.SUCCESS,
    amount: 1000,
    currency: 'XAF',
    senderId: 'sender1',
    travelerId: 'traveler1',
    packageId: 'package1',
    tripId: 'trip1',
    corridorId: 'corridor1',
    createdAt: new Date('2099-01-01T00:00:00.000Z'),
    updatedAt: new Date('2099-01-01T01:00:00.000Z'),
    disputes: [],
    amlCase: null,
    ...overrides,
    payout,
    refund,
  };
}

function transactionDetailRow(overrides: Partial<any> = {}) {
  return {
    ...transactionRow(overrides),
    escrowAmount: 1000,
    commission: 100,
    paymentConfirmedAt: null,
    deliveryConfirmedAt: null,
    deliveryCodeGeneratedAt: null,
    deliveryCodeExpiresAt: null,
    deliveryCodeConsumedAt: null,
    disputes: overrides.disputes ?? [],
    payout:
      overrides.payout === undefined
        ? null
        : overrides.payout === null
          ? null
          : {
              updatedAt: new Date('2099-01-01T01:00:00.000Z'),
              ...overrides.payout,
            },
    refund:
      overrides.refund === undefined
        ? null
        : overrides.refund === null
          ? null
          : {
              updatedAt: new Date('2099-01-01T01:00:00.000Z'),
              ...overrides.refund,
            },
    amlCase: overrides.amlCase ?? null,
  };
}

function evidenceRow(overrides: Partial<any> = {}) {
  return {
    id: 'ev1',
    targetType: EvidenceAttachmentObjectType.TRANSACTION,
    targetId: 'tx1',
    status: EvidenceAttachmentStatus.PENDING_REVIEW,
    attachmentType: EvidenceAttachmentType.DOCUMENT,
    createdAt: new Date('2099-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function fullEvidenceRow(overrides: Partial<any> = {}) {
  return {
    ...evidenceRow(overrides),
    label: 'Evidence',
    fileName: 'evidence.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1234,
    uploadedById: 'sender1',
    reviewedByAdminId: null,
    reviewedAt: null,
    rejectionReason: null,
    reviewNotes: null,
    updatedAt: new Date('2099-01-01T01:00:00.000Z'),
  };
}