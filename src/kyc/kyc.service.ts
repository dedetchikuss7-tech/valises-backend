import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AbandonmentKind,
  KycProvider,
  KycStatus,
  KycVerificationStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { buildKycRequirementErrorPayload } from './kyc-gating';

type StripeVerificationSession = {
  id: string;
  status: string;
  url?: string | null;
  last_error?: {
    code?: string | null;
    reason?: string | null;
  } | null;
};

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abandonment: AbandonmentService,
  ) {}

  async getMyKyc(userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const latest = await this.prisma.kycVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        status: true,
        providerSessionId: true,
        providerSessionUrl: true,
        failureReason: true,
        requestedAt: true,
        completedAt: true,
      },
    });

    return {
      userId: user.id,
      kycStatus: user.kycStatus,
      latestVerificationId: latest?.id ?? null,
      latestProvider: latest?.provider ?? null,
      latestVerificationStatus: latest?.status ?? null,
      latestProviderSessionId: latest?.providerSessionId ?? null,
      latestProviderSessionUrl: latest?.providerSessionUrl ?? null,
      latestFailureReason: latest?.failureReason ?? null,
      latestRequestedAt: latest?.requestedAt ?? null,
      latestCompletedAt: latest?.completedAt ?? null,
    };
  }

  async getUserKycStatusOrThrow(userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return user;
  }

  async assertUserVerifiedForRequirement(input: {
    userId: string;
    requiredFor: string;
    message: string;
    nextStepUrl?: string;
  }) {
    const user = await this.getUserKycStatusOrThrow(input.userId);

    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new BadRequestException(
        buildKycRequirementErrorPayload({
          userId: user.id,
          kycStatus: user.kycStatus,
          requiredFor: input.requiredFor,
          message: input.message,
          nextStepUrl: input.nextStepUrl,
        }),
      );
    }

    return user;
  }

  async createVerificationSession(userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        kycStatus: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException('User is already VERIFIED');
    }

    const stripeSession = await this.createStripeVerificationSession({
      userId: user.id,
      email: user.email,
    });

    const verification = await this.prisma.kycVerification.create({
      data: {
        userId: user.id,
        provider: KycProvider.STRIPE_IDENTITY,
        status: KycVerificationStatus.PENDING,
        providerSessionId: stripeSession.id,
        providerStatus: stripeSession.status,
        providerSessionUrl: stripeSession.url ?? null,
        requestedAt: new Date(),
        metadata: {
          source: 'kyc.me.session',
        },
      },
      select: {
        id: true,
        provider: true,
        status: true,
        providerSessionId: true,
        providerSessionUrl: true,
        requestedAt: true,
      },
    });

    await this.setUserKycStatus(user.id, KycStatus.PENDING);

    return {
      userId: user.id,
      kycStatus: KycStatus.PENDING,
      verificationId: verification.id,
      provider: verification.provider,
      verificationStatus: verification.status,
      providerSessionId: verification.providerSessionId,
      providerSessionUrl: verification.providerSessionUrl,
      requestedAt: verification.requestedAt,
    };
  }

  async syncVerification(
    verificationId: string,
    actorUserId: string,
    actorRole: Role,
  ) {
    if (!verificationId) {
      throw new BadRequestException('verificationId is required');
    }
    if (!actorUserId) {
      throw new BadRequestException('actorUserId is required');
    }

    const where =
      actorRole === Role.ADMIN
        ? { id: verificationId }
        : { id: verificationId, userId: actorUserId };

    const verification = await this.prisma.kycVerification.findFirst({
      where,
      select: {
        id: true,
        userId: true,
        provider: true,
        providerSessionId: true,
      },
    });

    if (!verification) {
      throw new NotFoundException(
        `KYC verification ${verificationId} not found`,
      );
    }

    if (actorRole !== Role.ADMIN && verification.userId !== actorUserId) {
      throw new ForbiddenException(
        'You cannot synchronize another user verification',
      );
    }

    if (verification.provider !== KycProvider.STRIPE_IDENTITY) {
      throw new BadRequestException(
        `Unsupported KYC provider: ${verification.provider}`,
      );
    }

    const session = await this.retrieveStripeVerificationSession(
      verification.providerSessionId,
    );

    let verificationStatus: KycVerificationStatus =
      KycVerificationStatus.PENDING;
    let userKycStatus: KycStatus = KycStatus.PENDING;
    let completedAt: Date | null = null;
    let failureReason: string | null = null;

    if (session.status === 'verified') {
      verificationStatus = KycVerificationStatus.VERIFIED;
      userKycStatus = KycStatus.VERIFIED;
      completedAt = new Date();
    } else if (session.status === 'requires_input') {
      verificationStatus = KycVerificationStatus.REJECTED;
      userKycStatus = KycStatus.REJECTED;
      completedAt = new Date();
      failureReason =
        session.last_error?.code ??
        session.last_error?.reason ??
        'requires_input';
    } else if (session.status === 'canceled') {
      verificationStatus = KycVerificationStatus.CANCELED;
      userKycStatus = KycStatus.NOT_STARTED;
      completedAt = new Date();
      failureReason = 'canceled';
    }

    await this.prisma.kycVerification.update({
      where: { id: verification.id },
      data: {
        status: verificationStatus,
        providerStatus: session.status,
        providerSessionUrl: session.url ?? null,
        failureReason,
        completedAt,
      },
    });

    await this.setUserKycStatus(verification.userId, userKycStatus);

    return {
      userId: verification.userId,
      verificationId: verification.id,
      provider: verification.provider,
      verificationStatus,
      providerStatus: session.status,
      userKycStatus,
      failureReason,
      completedAt,
    };
  }

  async setUserKycStatus(userId: string, kycStatus: KycStatus) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!kycStatus) throw new BadRequestException('kycStatus is required');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus },
      select: { id: true, kycStatus: true, updatedAt: true },
    });

    if (kycStatus === KycStatus.PENDING) {
      await this.abandonment.markAbandoned(
        { userId, role: 'USER' },
        {
          kind: AbandonmentKind.KYC_PENDING,
          metadata: {
            step: 'kyc_pending',
            kycStatus,
          },
        },
      );
    } else if (
      kycStatus === KycStatus.VERIFIED ||
      kycStatus === KycStatus.REJECTED ||
      kycStatus === KycStatus.NOT_STARTED
    ) {
      await this.abandonment.resolveActiveByReference({
        userId,
        kind: AbandonmentKind.KYC_PENDING,
      });
    }

    return updated;
  }

  private async createStripeVerificationSession(input: {
    userId: string;
    email: string;
  }): Promise<StripeVerificationSession> {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new BadRequestException(
        'Stripe Identity is not configured (missing STRIPE_SECRET_KEY)',
      );
    }

    const form = new URLSearchParams();
    form.append('type', 'document');
    form.append('client_reference_id', input.userId);
    form.append('provided_details[email]', input.email);
    form.append('options[document][require_matching_selfie]', 'true');
    form.append('metadata[user_id]', input.userId);

    const returnUrl = process.env.KYC_STRIPE_RETURN_URL;
    if (returnUrl) {
      form.append('return_url', returnUrl);
    }

    const response = await fetch(
      'https://api.stripe.com/v1/identity/verification_sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new BadRequestException(
        data?.error?.message ?? 'Stripe Identity session creation failed',
      );
    }

    return {
      id: data.id,
      status: data.status,
      url: data.url ?? null,
      last_error: data.last_error ?? null,
    };
  }

  private async retrieveStripeVerificationSession(
    providerSessionId: string,
  ): Promise<StripeVerificationSession> {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new BadRequestException(
        'Stripe Identity is not configured (missing STRIPE_SECRET_KEY)',
      );
    }

    const response = await fetch(
      `https://api.stripe.com/v1/identity/verification_sessions/${providerSessionId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new BadRequestException(
        data?.error?.message ?? 'Stripe Identity session retrieval failed',
      );
    }

    return {
      id: data.id,
      status: data.status,
      url: data.url ?? null,
      last_error: data.last_error ?? null,
    };
  }
}