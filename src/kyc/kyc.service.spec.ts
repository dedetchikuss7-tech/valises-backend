import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  KycProvider,
  KycStatus,
  KycVerificationStatus,
  Role,
} from '@prisma/client';
import { KycService } from './kyc.service';

describe('KycService', () => {
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

  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.KYC_STRIPE_RETURN_URL = 'https://app.valises.test/kyc/return';
    (global as any).fetch = fetchMock;

    service = new KycService(prisma as any, abandonment as any);
  });

  it('creates a Stripe Identity verification session and marks user KYC as pending', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'user@test.com',
        kycStatus: KycStatus.NOT_STARTED,
      })
      .mockResolvedValueOnce({
        id: 'user-1',
      });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'vs_123',
        status: 'requires_input',
        url: 'https://verify.stripe.com/session/vs_123',
        last_error: null,
      }),
    });

    prisma.kycVerification.create.mockResolvedValue({
      id: 'kv_1',
      provider: KycProvider.STRIPE_IDENTITY,
      status: KycVerificationStatus.PENDING,
      providerSessionId: 'vs_123',
      providerSessionUrl: 'https://verify.stripe.com/session/vs_123',
      requestedAt: new Date('2026-04-01T12:00:00.000Z'),
    });

    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      kycStatus: KycStatus.PENDING,
      updatedAt: new Date('2026-04-01T12:00:01.000Z'),
    });

    const result = await service.createVerificationSession('user-1');

    expect(result).toEqual({
      userId: 'user-1',
      kycStatus: KycStatus.PENDING,
      verificationId: 'kv_1',
      provider: KycProvider.STRIPE_IDENTITY,
      verificationStatus: KycVerificationStatus.PENDING,
      providerSessionId: 'vs_123',
      providerSessionUrl: 'https://verify.stripe.com/session/vs_123',
      requestedAt: new Date('2026-04-01T12:00:00.000Z'),
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(prisma.kycVerification.create).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { kycStatus: KycStatus.PENDING },
      select: { id: true, kycStatus: true, updatedAt: true },
    });
    expect(abandonment.markAbandoned).toHaveBeenCalled();
  });

  it('returns current KYC status and latest verification', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      kycStatus: KycStatus.PENDING,
    });

    prisma.kycVerification.findFirst.mockResolvedValue({
      id: 'kv_1',
      provider: KycProvider.STRIPE_IDENTITY,
      status: KycVerificationStatus.PENDING,
      providerSessionId: 'vs_123',
      providerSessionUrl: 'https://verify.stripe.com/session/vs_123',
      failureReason: null,
      requestedAt: new Date('2026-04-01T12:00:00.000Z'),
      completedAt: null,
    });

    const result = await service.getMyKyc('user-1');

    expect(result).toEqual({
      userId: 'user-1',
      kycStatus: KycStatus.PENDING,
      latestVerificationId: 'kv_1',
      latestProvider: KycProvider.STRIPE_IDENTITY,
      latestVerificationStatus: KycVerificationStatus.PENDING,
      latestProviderSessionId: 'vs_123',
      latestProviderSessionUrl: 'https://verify.stripe.com/session/vs_123',
      latestFailureReason: null,
      latestRequestedAt: new Date('2026-04-01T12:00:00.000Z'),
      latestCompletedAt: null,
    });
  });

  it('synchronizes a verified Stripe session and marks user as VERIFIED', async () => {
    prisma.kycVerification.findFirst.mockResolvedValue({
      id: 'kv_1',
      userId: 'user-1',
      provider: KycProvider.STRIPE_IDENTITY,
      providerSessionId: 'vs_123',
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'vs_123',
        status: 'verified',
        url: null,
        last_error: null,
      }),
    });

    prisma.kycVerification.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      kycStatus: KycStatus.VERIFIED,
      updatedAt: new Date('2026-04-01T12:02:00.000Z'),
    });

    const result = await service.syncVerification(
      'kv_1',
      'user-1',
      Role.USER,
    );

    expect(result.userId).toBe('user-1');
    expect(result.verificationId).toBe('kv_1');
    expect(result.verificationStatus).toBe(KycVerificationStatus.VERIFIED);
    expect(result.providerStatus).toBe('verified');
    expect(result.userKycStatus).toBe(KycStatus.VERIFIED);

    expect(prisma.kycVerification.update).toHaveBeenCalledWith({
      where: { id: 'kv_1' },
      data: expect.objectContaining({
        status: KycVerificationStatus.VERIFIED,
        providerStatus: 'verified',
        completedAt: expect.any(Date),
      }),
    });

    expect(abandonment.resolveActiveByReference).toHaveBeenCalled();
  });

  it('synchronizes a requires_input Stripe session and marks user as REJECTED', async () => {
    prisma.kycVerification.findFirst.mockResolvedValue({
      id: 'kv_1',
      userId: 'user-1',
      provider: KycProvider.STRIPE_IDENTITY,
      providerSessionId: 'vs_123',
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'vs_123',
        status: 'requires_input',
        url: 'https://verify.stripe.com/session/vs_123',
        last_error: {
          code: 'document_unverified_other',
          reason: null,
        },
      }),
    });

    prisma.kycVerification.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      kycStatus: KycStatus.REJECTED,
      updatedAt: new Date('2026-04-01T12:02:00.000Z'),
    });

    const result = await service.syncVerification(
      'kv_1',
      'user-1',
      Role.USER,
    );

    expect(result.verificationStatus).toBe(KycVerificationStatus.REJECTED);
    expect(result.providerStatus).toBe('requires_input');
    expect(result.userKycStatus).toBe(KycStatus.REJECTED);
    expect(result.failureReason).toBe('document_unverified_other');
  });

  it('throws when user is already verified and tries to create a new session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      kycStatus: KycStatus.VERIFIED,
    });

    await expect(service.createVerificationSession('user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws when verification does not exist', async () => {
    prisma.kycVerification.findFirst.mockResolvedValue(null);

    await expect(
      service.syncVerification('missing', 'user-1', Role.USER),
    ).rejects.toThrow(NotFoundException);
  });
});