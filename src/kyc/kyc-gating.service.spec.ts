import { NotFoundException } from '@nestjs/common';
import { KycStatus } from '@prisma/client';
import { KycService } from './kyc.service';

describe('KycService - KYC requirement assertions', () => {
  let service: KycService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    kycVerification: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const abandonment = {
    markAbandoned: jest.fn(),
    resolveActiveByReference: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KycService(prisma as any, abandonment as any);
  });

  it('returns the user when KYC is VERIFIED for the requested requirement', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'traveler-1',
      kycStatus: KycStatus.VERIFIED,
    });

    const result = await service.assertUserVerifiedForRequirement({
      userId: 'traveler-1',
      requiredFor: 'TRANSACTION_PAYMENT_SUCCESS_TRAVELER',
      message: 'Traveler KYC must be VERIFIED before payment can be confirmed.',
    });

    expect(result).toEqual({
      id: 'traveler-1',
      kycStatus: KycStatus.VERIFIED,
    });
  });

  it('throws a standardized KYC_REQUIRED payload when KYC is not VERIFIED', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'traveler-1',
      kycStatus: KycStatus.PENDING,
    });

    await expect(
      service.assertUserVerifiedForRequirement({
        userId: 'traveler-1',
        requiredFor: 'TRANSACTION_PAYMENT_SUCCESS_TRAVELER',
        message: 'Traveler KYC must be VERIFIED before payment can be confirmed.',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'KYC_REQUIRED',
        requiredFor: 'TRANSACTION_PAYMENT_SUCCESS_TRAVELER',
        requiredKycStatus: KycStatus.VERIFIED,
        nextStep: 'KYC',
        nextStepUrl: '/kyc',
        userId: 'traveler-1',
        kycStatus: KycStatus.PENDING,
      },
    });
  });

  it('throws NotFoundException when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.assertUserVerifiedForRequirement({
        userId: 'missing-user',
        requiredFor: 'TRANSACTION_PAYMENT_SUCCESS_TRAVELER',
        message: 'Traveler KYC must be VERIFIED before payment can be confirmed.',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});