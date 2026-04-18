import {
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  KycStatus,
  LegalAcceptanceContext,
  LegalDocumentType,
  Role,
  TrustProfileStatus,
} from '@prisma/client';
import { MobileContractService } from './mobile-contract.service';

describe('MobileContractService', () => {
  let service: MobileContractService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    userTrustProfile: {
      upsert: jest.fn(),
    },
    behaviorRestriction: {
      findMany: jest.fn(),
    },
    legalAcceptance: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MobileContractService(prismaMock as any);
  });

  it('builds a mobile contract snapshot with derived capabilities', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user1',
      email: 'user1@test.com',
      role: Role.USER,
      kycStatus: KycStatus.PENDING,
    });

    prismaMock.userTrustProfile.upsert.mockResolvedValue({
      userId: 'user1',
      score: 72,
      status: TrustProfileStatus.UNDER_REVIEW,
      totalEvents: 8,
      positiveEvents: 3,
      negativeEvents: 5,
      activeRestrictionCount: 2,
      lastEventAt: new Date('2026-04-18T10:00:00.000Z'),
    });

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([
      {
        id: 'restriction1',
        kind: 'BLOCK_MESSAGING',
        scope: BehaviorRestrictionScope.MESSAGING,
        status: BehaviorRestrictionStatus.ACTIVE,
        reasonCode: 'MESSAGE_ABUSE',
        reasonSummary: 'Too many blocked messages',
        expiresAt: null,
        imposedAt: new Date('2026-04-18T11:00:00.000Z'),
      },
      {
        id: 'restriction2',
        kind: 'LIMIT_TRANSACTIONS',
        scope: BehaviorRestrictionScope.TRANSACTIONS,
        status: BehaviorRestrictionStatus.ACTIVE,
        reasonCode: 'RISK_REVIEW',
        reasonSummary: 'Temporary review',
        expiresAt: null,
        imposedAt: new Date('2026-04-18T12:00:00.000Z'),
      },
    ]);

    prismaMock.legalAcceptance.findMany.mockResolvedValue([
      {
        documentType: LegalDocumentType.TERMS_OF_SERVICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.GLOBAL,
      },
      {
        documentType: LegalDocumentType.PRIVACY_NOTICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.GLOBAL,
      },
    ]);

    const result = await service.getMyContract('user1');

    expect(result.user).toEqual({
      id: 'user1',
      email: 'user1@test.com',
      role: Role.USER,
    });

    expect(result.kyc).toEqual({
      status: KycStatus.PENDING,
      isVerified: false,
      nextStep: 'KYC',
      nextStepUrl: '/kyc',
    });

    expect(result.trustProfile).toEqual({
      score: 72,
      status: TrustProfileStatus.UNDER_REVIEW,
      totalEvents: 8,
      positiveEvents: 3,
      negativeEvents: 5,
      activeRestrictionCount: 2,
      lastEventAt: new Date('2026-04-18T10:00:00.000Z'),
    });

    expect(result.capabilities).toEqual({
      canPublishTrips: true,
      canPublishPackages: true,
      canMessage: false,
      canCreateTransactions: false,
    });

    expect(result.legal).toEqual({
      hasAcceptedTermsOfService: true,
      hasAcceptedPrivacyNotice: true,
      hasAcceptedEscrowNotice: false,
      acceptedGlobalDocumentKeys: [
        'TERMS_OF_SERVICE:v1',
        'PRIVACY_NOTICE:v1',
      ],
    });

    expect(result.activeRestrictions).toHaveLength(2);
  });

  it('returns verified KYC and unrestricted capabilities when no active restrictions exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user2',
      email: 'user2@test.com',
      role: Role.USER,
      kycStatus: KycStatus.VERIFIED,
    });

    prismaMock.userTrustProfile.upsert.mockResolvedValue({
      userId: 'user2',
      score: 100,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 0,
      positiveEvents: 0,
      negativeEvents: 0,
      activeRestrictionCount: 0,
      lastEventAt: null,
    });

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);
    prismaMock.legalAcceptance.findMany.mockResolvedValue([]);

    const result = await service.getMyContract('user2');

    expect(result.kyc).toEqual({
      status: KycStatus.VERIFIED,
      isVerified: true,
      nextStep: null,
      nextStepUrl: null,
    });

    expect(result.capabilities).toEqual({
      canPublishTrips: true,
      canPublishPackages: true,
      canMessage: true,
      canCreateTransactions: true,
    });
  });
});