import {
  AmlCaseStatus,
  AmlDecisionAction,
  AmlRiskLevel,
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  PackageContentComplianceStatus,
  TrustProfileStatus,
} from '@prisma/client';
import { AmlService } from './aml.service';

describe('AmlService', () => {
  let service: AmlService;

  const prismaMock = {
    transaction: {
      findUnique: jest.fn(),
    },
    amlCase: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    behaviorRestriction: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    userTrustProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const trustServiceMock = {
    recordEventIfMissing: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AmlService(prismaMock as any, trustServiceMock as any);

    trustServiceMock.recordEventIfMissing.mockResolvedValue(undefined);
    prismaMock.behaviorRestriction.findFirst.mockResolvedValue(null);
    prismaMock.behaviorRestriction.create.mockResolvedValue({ id: 'br-1' });
    prismaMock.behaviorRestriction.count.mockResolvedValue(1);
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);
    prismaMock.behaviorRestriction.update.mockResolvedValue({ id: 'br-1' });
    prismaMock.userTrustProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      userId: 'sender1',
      score: 100,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 0,
      positiveEvents: 0,
      negativeEvents: 0,
      activeRestrictionCount: 0,
    });
    prismaMock.userTrustProfile.create.mockResolvedValue({
      id: 'profile-created',
      userId: 'sender1',
      score: 100,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 0,
      positiveEvents: 0,
      negativeEvents: 0,
      activeRestrictionCount: 0,
    });
    prismaMock.userTrustProfile.update.mockResolvedValue({
      id: 'profile-updated',
      userId: 'sender1',
      score: 100,
      status: TrustProfileStatus.RESTRICTED,
      totalEvents: 0,
      positiveEvents: 0,
      negativeEvents: 0,
      activeRestrictionCount: 1,
    });
  });

  it('returns ALLOW for a clean transaction and releases matching AML restrictions', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
      packageId: 'pkg1',
      amount: 150000,
      currency: 'XAF',
      package: {
        id: 'pkg1',
        declaredValueAmount: 50000,
        declaredItemCount: 2,
        containsProhibitedItems: false,
        containsValuableItems: false,
        containsBattery: false,
        containsMedicine: false,
        containsElectronic: false,
        contentComplianceStatus:
          PackageContentComplianceStatus.DECLARED_CLEAR,
      },
      amlCase: null,
    });

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.evaluateTransaction('tx1');

    expect(result).toEqual({
      transactionId: 'tx1',
      allowed: true,
      riskLevel: AmlRiskLevel.LOW,
      recommendedAction: AmlDecisionAction.ALLOW,
      signalCodes: [],
      signalCount: 0,
      reasonSummary: null,
      caseCreated: false,
      amlCase: null,
    });
    expect(trustServiceMock.recordEventIfMissing).not.toHaveBeenCalled();
  });

  it('creates a review AML case, records trust events, and imposes WARNING_ONLY transaction restrictions', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx2',
      senderId: 'sender1',
      travelerId: 'traveler1',
      packageId: 'pkg2',
      amount: 1200000,
      currency: 'XAF',
      package: {
        id: 'pkg2',
        declaredValueAmount: 100000,
        declaredItemCount: 2,
        containsProhibitedItems: false,
        containsValuableItems: false,
        containsBattery: false,
        containsMedicine: false,
        containsElectronic: false,
        contentComplianceStatus:
          PackageContentComplianceStatus.DECLARED_CLEAR,
      },
      amlCase: null,
    });

    prismaMock.amlCase.create.mockResolvedValue({
      id: 'aml-review-1',
      transactionId: 'tx2',
      senderId: 'sender1',
      travelerId: 'traveler1',
      riskLevel: AmlRiskLevel.HIGH,
      signalCodes: ['LARGE_XAF_AMOUNT'],
      status: AmlCaseStatus.OPEN,
      currentAction: AmlDecisionAction.REQUIRE_REVIEW,
    });

    const result = await service.evaluateTransaction('tx2');

    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(AmlRiskLevel.HIGH);
    expect(result.recommendedAction).toBe(AmlDecisionAction.REQUIRE_REVIEW);
    expect(trustServiceMock.recordEventIfMissing).toHaveBeenCalledTimes(2);

    expect(prismaMock.behaviorRestriction.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'sender1',
          kind: BehaviorRestrictionKind.WARNING_ONLY,
          scope: BehaviorRestrictionScope.TRANSACTIONS,
          status: BehaviorRestrictionStatus.ACTIVE,
          reasonCode: 'AML_REVIEW_REQUIRED:tx2',
        }),
      }),
    );

    expect(prismaMock.behaviorRestriction.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'traveler1',
          kind: BehaviorRestrictionKind.WARNING_ONLY,
          scope: BehaviorRestrictionScope.TRANSACTIONS,
          status: BehaviorRestrictionStatus.ACTIVE,
          reasonCode: 'AML_REVIEW_REQUIRED:tx2',
        }),
      }),
    );
  });

  it('creates a blocked AML case, records trust events, and imposes LIMIT_TRANSACTIONS restrictions', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx3',
      senderId: 'sender1',
      travelerId: 'traveler1',
      packageId: 'pkg3',
      amount: 300000,
      currency: 'XAF',
      package: {
        id: 'pkg3',
        declaredValueAmount: 50000,
        declaredItemCount: 1,
        containsProhibitedItems: true,
        containsValuableItems: false,
        containsBattery: false,
        containsMedicine: false,
        containsElectronic: false,
        contentComplianceStatus: PackageContentComplianceStatus.BLOCKED,
      },
      amlCase: null,
    });

    prismaMock.amlCase.create.mockResolvedValue({
      id: 'aml-block-1',
      transactionId: 'tx3',
      senderId: 'sender1',
      travelerId: 'traveler1',
      riskLevel: AmlRiskLevel.CRITICAL,
      signalCodes: ['PROHIBITED_OR_BLOCKED_CONTENT'],
      status: AmlCaseStatus.OPEN,
      currentAction: AmlDecisionAction.BLOCK,
    });

    const result = await service.evaluateTransaction('tx3');

    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(AmlRiskLevel.CRITICAL);
    expect(result.recommendedAction).toBe(AmlDecisionAction.BLOCK);
    expect(result.signalCodes).toContain('PROHIBITED_OR_BLOCKED_CONTENT');
    expect(trustServiceMock.recordEventIfMissing).toHaveBeenCalledTimes(2);

    expect(prismaMock.behaviorRestriction.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'sender1',
          kind: BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
          scope: BehaviorRestrictionScope.TRANSACTIONS,
          status: BehaviorRestrictionStatus.ACTIVE,
          reasonCode: 'AML_BLOCK:tx3',
        }),
      }),
    );

    expect(prismaMock.behaviorRestriction.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'traveler1',
          kind: BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
          scope: BehaviorRestrictionScope.TRANSACTIONS,
          status: BehaviorRestrictionStatus.ACTIVE,
          reasonCode: 'AML_BLOCK:tx3',
        }),
      }),
    );
  });

  it('releases AML restrictions when resolving a case to ALLOW', async () => {
    prismaMock.amlCase.findUnique.mockResolvedValue({
      id: 'aml1',
      transactionId: 'tx9',
      senderId: 'sender1',
      travelerId: 'traveler1',
      riskLevel: AmlRiskLevel.HIGH,
      signalCodes: ['LARGE_XAF_AMOUNT'],
      status: AmlCaseStatus.OPEN,
      currentAction: AmlDecisionAction.REQUIRE_REVIEW,
    });

    prismaMock.amlCase.update.mockResolvedValue({
      id: 'aml1',
      transactionId: 'tx9',
      senderId: 'sender1',
      travelerId: 'traveler1',
      riskLevel: AmlRiskLevel.HIGH,
      signalCodes: ['LARGE_XAF_AMOUNT'],
      status: AmlCaseStatus.RESOLVED,
      currentAction: AmlDecisionAction.ALLOW,
    });

    prismaMock.behaviorRestriction.findMany
      .mockResolvedValueOnce([{ id: 'r1' }])
      .mockResolvedValueOnce([{ id: 'r2' }]);

    const result = await service.resolveCase(
      'aml1',
      { action: 'ALLOW', notes: 'approved' },
      'admin1',
    );

    expect(prismaMock.behaviorRestriction.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        status: BehaviorRestrictionStatus.RELEASED,
        releasedAt: expect.any(Date),
        releasedById: 'admin1',
      },
    });

    expect(prismaMock.behaviorRestriction.update).toHaveBeenCalledWith({
      where: { id: 'r2' },
      data: {
        status: BehaviorRestrictionStatus.RELEASED,
        releasedAt: expect.any(Date),
        releasedById: 'admin1',
      },
    });

    expect(result).toEqual({
      id: 'aml1',
      transactionId: 'tx9',
      senderId: 'sender1',
      travelerId: 'traveler1',
      riskLevel: AmlRiskLevel.HIGH,
      signalCodes: ['LARGE_XAF_AMOUNT'],
      status: AmlCaseStatus.RESOLVED,
      currentAction: AmlDecisionAction.ALLOW,
    });
  });

  it('resynchronizes restrictions when resolving a case to BLOCK', async () => {
    prismaMock.amlCase.findUnique.mockResolvedValue({
      id: 'aml2',
      transactionId: 'tx10',
      senderId: 'sender1',
      travelerId: 'traveler1',
      riskLevel: AmlRiskLevel.CRITICAL,
      signalCodes: ['PROHIBITED_OR_BLOCKED_CONTENT'],
      status: AmlCaseStatus.OPEN,
      currentAction: AmlDecisionAction.REQUIRE_REVIEW,
    });

    prismaMock.amlCase.update.mockResolvedValue({
      id: 'aml2',
      transactionId: 'tx10',
      senderId: 'sender1',
      travelerId: 'traveler1',
      riskLevel: AmlRiskLevel.CRITICAL,
      signalCodes: ['PROHIBITED_OR_BLOCKED_CONTENT'],
      status: AmlCaseStatus.RESOLVED,
      currentAction: AmlDecisionAction.BLOCK,
    });

    prismaMock.behaviorRestriction.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.resolveCase(
      'aml2',
      { action: 'BLOCK', notes: 'blocked' },
      'admin1',
    );

    expect(prismaMock.behaviorRestriction.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'sender1',
          kind: BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
          reasonCode: 'AML_BLOCK:tx10',
        }),
      }),
    );

    expect(prismaMock.behaviorRestriction.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'traveler1',
          kind: BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
          reasonCode: 'AML_BLOCK:tx10',
        }),
      }),
    );

    expect(result).toEqual({
      id: 'aml2',
      transactionId: 'tx10',
      senderId: 'sender1',
      travelerId: 'traveler1',
      riskLevel: AmlRiskLevel.CRITICAL,
      signalCodes: ['PROHIBITED_OR_BLOCKED_CONTENT'],
      status: AmlCaseStatus.RESOLVED,
      currentAction: AmlDecisionAction.BLOCK,
    });
  });
});