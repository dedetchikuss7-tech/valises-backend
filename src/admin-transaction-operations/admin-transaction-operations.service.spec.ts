import {
  BehaviorRestrictionStatus,
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

describe('AdminTransactionOperationsService', () => {
  let service: AdminTransactionOperationsService;

  const prismaMock = {
    transaction: {
      findMany: jest.fn(),
    },
    evidenceAttachment: {
      findMany: jest.fn(),
    },
    behaviorRestriction: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminTransactionOperationsService(prismaMock as any);
  });

  it('returns queue rows with high severity for open dispute and evidence review', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({
        id: 'tx1',
        disputes: [{ id: 'dp1', status: DisputeStatus.OPEN }],
        payout: { id: 'po1', status: PayoutStatus.REQUESTED },
      }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceRow({
        targetType: EvidenceAttachmentObjectType.DISPUTE,
        targetId: 'dp1',
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
        attachmentType: EvidenceAttachmentType.DISPUTE_EVIDENCE,
      }),
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listQueue({ limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.items[0].hasOpenDispute).toBe(true);
    expect(result.items[0].latestDisputeId).toBe('dp1');
    expect(result.items[0].hasPendingEvidenceReview).toBe(true);
    expect(result.items[0].hasPendingDisputeEvidenceReview).toBe(true);
    expect(result.items[0].pendingEvidenceReviewCount).toBe(1);
    expect(result.items[0].operationalSeverity).toBe(
      TransactionOperationalSeverity.HIGH,
    );
    expect(result.items[0].recommendedAction).toBe(
      TransactionRecommendedAction.REVIEW_DISPUTE_AND_EVIDENCE,
    );
  });

  it('detects pending delivery proof review', async () => {
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
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
        attachmentType: EvidenceAttachmentType.DELIVERY_PROOF,
      }),
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listQueue({ limit: 20, offset: 0 });

    expect(result.items[0].hasPendingDeliveryEvidenceReview).toBe(true);
    expect(result.items[0].pendingDeliveryEvidenceReviewCount).toBe(1);
    expect(result.items[0].recommendedAction).toBe(
      TransactionRecommendedAction.REVIEW_DELIVERY_PROOF,
    );
    expect(result.items[0].reasons).toContain(
      'PENDING_DELIVERY_EVIDENCE_REVIEW',
    );
  });

  it('detects delivered transaction without accepted delivery proof', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({
        id: 'tx-no-proof',
        status: TransactionStatus.DELIVERED,
      }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([]);
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listQueue({ limit: 20, offset: 0 });

    expect(result.items[0].hasAcceptedDeliveryProof).toBe(false);
    expect(result.items[0].reasons).toContain(
      'DELIVERED_WITHOUT_ACCEPTED_DELIVERY_PROOF',
    );
    expect(result.items[0].recommendedAction).toBe(
      TransactionRecommendedAction.REVIEW_DELIVERY_READINESS,
    );
  });

  it('does not flag delivered transaction when accepted delivery proof exists', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({
        id: 'tx-proof-ok',
        status: TransactionStatus.DELIVERED,
      }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceRow({
        targetType: EvidenceAttachmentObjectType.DELIVERY,
        targetId: 'tx-proof-ok',
        status: EvidenceAttachmentStatus.ACCEPTED,
        attachmentType: EvidenceAttachmentType.DELIVERY_PROOF,
      }),
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listQueue({ limit: 20, offset: 0 });

    expect(result.items[0].hasAcceptedDeliveryProof).toBe(true);
    expect(result.items[0].reasons).not.toContain(
      'DELIVERED_WITHOUT_ACCEPTED_DELIVERY_PROOF',
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
        status: TransactionStatus.PAID,
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
      transactionRow({
        id: 'tx-clean',
      }),
      transactionRow({
        id: 'tx-delivery',
      }),
    ]);

    prismaMock.evidenceAttachment.findMany.mockResolvedValue([
      evidenceRow({
        targetType: EvidenceAttachmentObjectType.DELIVERY,
        targetId: 'tx-delivery',
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
        attachmentType: EvidenceAttachmentType.DELIVERY_PROOF,
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

  it('returns summary counts', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      transactionRow({
        id: 'tx1',
        disputes: [{ id: 'dp1', status: DisputeStatus.OPEN }],
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
        targetType: EvidenceAttachmentObjectType.DISPUTE,
        targetId: 'dp1',
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
        attachmentType: EvidenceAttachmentType.DISPUTE_EVIDENCE,
      }),
      evidenceRow({
        targetType: EvidenceAttachmentObjectType.DELIVERY,
        targetId: 'tx3',
        status: EvidenceAttachmentStatus.REJECTED,
        attachmentType: EvidenceAttachmentType.DELIVERY_PROOF,
      }),
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.getSummary();

    expect(result.totalRows).toBe(3);
    expect(result.highSeverityCount).toBe(2);
    expect(result.pendingPayoutCount).toBe(1);
    expect(result.pendingDisputeEvidenceReviewCount).toBe(1);
    expect(result.rejectedDeliveryProofCount).toBe(1);
    expect(result.missingAcceptedDeliveryProofCount).toBe(1);
  });
});

function transactionRow(overrides: Partial<any> = {}) {
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
    payout: null,
    refund: null,
    amlCase: null,
    ...overrides,
  };
}

function evidenceRow(overrides: Partial<any> = {}) {
  return {
    targetType: EvidenceAttachmentObjectType.TRANSACTION,
    targetId: 'tx1',
    status: EvidenceAttachmentStatus.PENDING_REVIEW,
    attachmentType: EvidenceAttachmentType.DOCUMENT,
    createdAt: new Date('2099-01-01T00:30:00.000Z'),
    ...overrides,
  };
}