import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AmlDecisionAction,
  AmlRiskLevel,
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  LegalAcceptanceContext,
  LegalDocumentType,
} from '@prisma/client';
import { EnforcementService } from './enforcement.service';

describe('EnforcementService', () => {
  let service: EnforcementService;

  const prisma = {
    behaviorRestriction: {
      findFirst: jest.fn(),
    },
    legalAcceptance: {
      findFirst: jest.fn(),
    },
  };

  const amlService = {
    evaluateTransaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EnforcementService(prisma as any, amlService as any);
  });

  it('allows package publish when no restriction exists and package rules were acknowledged', async () => {
    prisma.behaviorRestriction.findFirst.mockResolvedValueOnce(null);
    prisma.legalAcceptance.findFirst.mockResolvedValueOnce({ id: 'legal-1' });

    await expect(
      service.assertPackagePublishAllowed({
        userId: 'user-1',
        packageId: 'pkg-1',
      }),
    ).resolves.toBeUndefined();

    expect(prisma.legalAcceptance.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        documentType: LegalDocumentType.PROHIBITED_ITEMS_NOTICE,
        context: LegalAcceptanceContext.PACKAGE,
        packageId: 'pkg-1',
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
      },
    });
  });

  it('blocks package publish when an active publishing restriction exists', async () => {
    prisma.behaviorRestriction.findFirst.mockResolvedValueOnce({
      id: 'restriction-1',
      kind: BehaviorRestrictionKind.BLOCK_PUBLISHING,
      scope: BehaviorRestrictionScope.PACKAGES,
      status: BehaviorRestrictionStatus.ACTIVE,
      reasonCode: 'MANUAL_RESTRICTION',
      reasonSummary: 'Publishing is blocked.',
      expiresAt: null,
    });

    await expect(
      service.assertPackagePublishAllowed({
        userId: 'user-1',
        packageId: 'pkg-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires package rules legal acknowledgment before publish', async () => {
    prisma.behaviorRestriction.findFirst.mockResolvedValueOnce(null);
    prisma.legalAcceptance.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.assertPackagePublishAllowed({
        userId: 'user-1',
        packageId: 'pkg-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows transaction creation when sender and traveler are not restricted', async () => {
    prisma.behaviorRestriction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      service.assertTransactionCreateAllowed({
        senderId: 'sender-1',
        travelerId: 'traveler-1',
        tripId: 'trip-1',
        packageId: 'pkg-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('blocks transaction creation when sender restriction exists', async () => {
    prisma.behaviorRestriction.findFirst.mockResolvedValueOnce({
      id: 'restriction-1',
      kind: BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
      scope: BehaviorRestrictionScope.TRANSACTIONS,
      status: BehaviorRestrictionStatus.ACTIVE,
      reasonCode: 'AML_REVIEW',
      reasonSummary: 'Transactions are temporarily limited.',
      expiresAt: null,
    });

    await expect(
      service.assertTransactionCreateAllowed({
        senderId: 'sender-1',
        travelerId: 'traveler-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows payment success when no restrictions exist and AML allows the transaction', async () => {
    prisma.behaviorRestriction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    amlService.evaluateTransaction.mockResolvedValueOnce({
      transactionId: 'tx-1',
      allowed: true,
      riskLevel: AmlRiskLevel.LOW,
      recommendedAction: AmlDecisionAction.ALLOW,
      signalCodes: [],
      signalCount: 0,
      reasonSummary: null,
      amlCase: null,
    });

    await expect(
      service.assertTransactionPaymentSuccessAllowed({
        transactionId: 'tx-1',
        senderId: 'sender-1',
        travelerId: 'traveler-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('blocks payment success when AML recommends BLOCK', async () => {
    prisma.behaviorRestriction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    amlService.evaluateTransaction.mockResolvedValueOnce({
      transactionId: 'tx-1',
      allowed: false,
      riskLevel: AmlRiskLevel.HIGH,
      recommendedAction: AmlDecisionAction.BLOCK,
      signalCodes: ['PROHIBITED_OR_BLOCKED_CONTENT'],
      signalCount: 1,
      reasonSummary: 'Blocked content declared.',
      amlCase: { id: 'aml-1' },
    });

    await expect(
      service.assertTransactionPaymentSuccessAllowed({
        transactionId: 'tx-1',
        senderId: 'sender-1',
        travelerId: 'traveler-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires manual review when AML recommends REQUIRE_REVIEW', async () => {
    prisma.behaviorRestriction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    amlService.evaluateTransaction.mockResolvedValueOnce({
      transactionId: 'tx-1',
      allowed: false,
      riskLevel: AmlRiskLevel.MEDIUM,
      recommendedAction: AmlDecisionAction.REQUIRE_REVIEW,
      signalCodes: ['VALUABLE_ITEMS_DECLARED'],
      signalCount: 1,
      reasonSummary: 'Valuable items declared.',
      amlCase: { id: 'aml-2' },
    });

    await expect(
      service.assertTransactionPaymentSuccessAllowed({
        transactionId: 'tx-1',
        senderId: 'sender-1',
        travelerId: 'traveler-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows admins to bypass messaging restriction checks', async () => {
    await expect(
      service.assertMessagingAllowed({
        userId: 'admin-1',
        role: 'ADMIN',
        transactionId: 'tx-1',
      }),
    ).resolves.toBeUndefined();

    expect(prisma.behaviorRestriction.findFirst).not.toHaveBeenCalled();
  });

  it('blocks messaging when a messaging restriction exists', async () => {
    prisma.behaviorRestriction.findFirst.mockResolvedValueOnce({
      id: 'restriction-1',
      kind: BehaviorRestrictionKind.BLOCK_MESSAGING,
      scope: BehaviorRestrictionScope.MESSAGING,
      status: BehaviorRestrictionStatus.ACTIVE,
      reasonCode: 'SPAM',
      reasonSummary: 'Messaging blocked.',
      expiresAt: null,
    });

    await expect(
      service.assertMessagingAllowed({
        userId: 'user-1',
        role: 'USER',
        transactionId: 'tx-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});