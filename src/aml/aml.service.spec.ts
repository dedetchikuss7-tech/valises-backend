import {
  AmlCaseStatus,
  AmlDecisionAction,
  AmlRiskLevel,
  PackageContentComplianceStatus,
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
  };

  const trustServiceMock = {
    recordEventIfMissing: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AmlService(prismaMock as any, trustServiceMock as any);
  });

  it('returns ALLOW for a clean transaction', async () => {
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

  it('creates a review AML case for a large XAF amount and auto-wires trust events', async () => {
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
      status: AmlCaseStatus.OPEN,
      currentAction: AmlDecisionAction.REQUIRE_REVIEW,
    });

    const result = await service.evaluateTransaction('tx2');

    expect(prismaMock.amlCase.create).toHaveBeenCalled();
    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(AmlRiskLevel.HIGH);
    expect(result.recommendedAction).toBe(AmlDecisionAction.REQUIRE_REVIEW);
    expect(result.signalCodes).toContain('LARGE_XAF_AMOUNT');
    expect(trustServiceMock.recordEventIfMissing).toHaveBeenCalledTimes(2);
  });

  it('creates a blocked AML case for prohibited content and auto-wires trust events', async () => {
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
      status: AmlCaseStatus.OPEN,
      currentAction: AmlDecisionAction.BLOCK,
    });

    const result = await service.evaluateTransaction('tx3');

    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(AmlRiskLevel.CRITICAL);
    expect(result.recommendedAction).toBe(AmlDecisionAction.BLOCK);
    expect(result.signalCodes).toContain('PROHIBITED_OR_BLOCKED_CONTENT');
    expect(trustServiceMock.recordEventIfMissing).toHaveBeenCalledTimes(2);
  });

  it('resolves an AML case', async () => {
    prismaMock.amlCase.findUnique.mockResolvedValue({
      id: 'aml1',
    });

    prismaMock.amlCase.update.mockResolvedValue({
      id: 'aml1',
      status: AmlCaseStatus.RESOLVED,
      currentAction: AmlDecisionAction.ALLOW,
    });

    const result = await service.resolveCase(
      'aml1',
      { action: 'ALLOW', notes: 'approved' },
      'admin1',
    );

    expect(prismaMock.amlCase.update).toHaveBeenCalledWith({
      where: { id: 'aml1' },
      data: expect.objectContaining({
        currentAction: AmlDecisionAction.ALLOW,
        status: AmlCaseStatus.RESOLVED,
        reviewedById: 'admin1',
        reviewNotes: 'approved',
      }),
    });

    expect(result).toEqual({
      id: 'aml1',
      status: AmlCaseStatus.RESOLVED,
      currentAction: AmlDecisionAction.ALLOW,
    });
  });
});