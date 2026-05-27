import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
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
import {
  KYC_PROVIDER,
  KycProvider as IKycProvider,
} from './providers/kyc.provider';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abandonment: AbandonmentService,
    @Inject(KYC_PROVIDER) private readonly provider: IKycProvider,
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
      select: { id: true, email: true, kycStatus: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException('User is already VERIFIED');
    }

    const session = await this.provider.createVerificationSession({
      userId: user.id,
      email: user.email,
    });

    const prismaProvider = this.provider.providerName as KycProvider;

    const verification = await this.prisma.kycVerification.create({
      data: {
        userId: user.id,
        provider: prismaProvider,
        status: KycVerificationStatus.PENDING,
        providerSessionId: session.sessionId,
        providerStatus: session.rawStatus,
        providerSessionUrl: session.sessionUrl ?? null,
        requestedAt: new Date(),
        metadata: { source: 'kyc.me.session' },
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

    const session = await this.provider.retrieveSession(
      verification.providerSessionId,
    );

    const { verificationStatus, userKycStatus, completedAt, failureReason } =
      this.resolveStatusFromSession(session);

    await this.prisma.kycVerification.update({
      where: { id: verification.id },
      data: {
        status: verificationStatus,
        providerStatus: session.rawStatus,
        providerSessionUrl: session.sessionUrl ?? null,
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
      providerStatus: session.rawStatus,
      userKycStatus,
      failureReason,
      completedAt,
    };
  }

  async handleKycWebhook(
    body: unknown,
    headers: Record<string, string>,
  ): Promise<{ processed: boolean; ignored?: boolean; userId?: string; verificationId?: string; kycStatus?: KycStatus }> {
    const rawPayload = typeof body === 'string' ? body : JSON.stringify(body);

    const signatureValid = this.provider.verifyWebhookSignature(
      rawPayload,
      headers,
    );
    if (!signatureValid) {
      throw new UnauthorizedException('Invalid KYC webhook signature');
    }

    const event = this.provider.parseWebhookEvent(rawPayload);

    const verification = await this.prisma.kycVerification.findFirst({
      where: { providerSessionId: event.sessionId },
      select: { id: true, userId: true },
    });

    if (!verification) {
      return { processed: false, ignored: true };
    }

    const { verificationStatus, userKycStatus, completedAt, failureReason } =
      this.resolveStatusFromSession({
        status: event.status,
        rawStatus: event.rawStatus,
        failureCode: event.failureCode,
        failureReason: event.failureReason,
        sessionId: event.sessionId,
        sessionUrl: null,
      });

    await this.prisma.kycVerification.update({
      where: { id: verification.id },
      data: {
        status: verificationStatus,
        providerStatus: event.rawStatus,
        failureReason,
        completedAt,
      },
    });

    await this.setUserKycStatus(verification.userId, userKycStatus);

    if (userKycStatus === KycStatus.REJECTED) {
      await this.prisma.user.update({
        where: { id: verification.userId },
        data: {
          kycRejectionReason: failureReason,
          kycAttemptCount: { increment: 1 },
          kycLastAttemptAt: new Date(),
        },
      });
    } else if (userKycStatus === KycStatus.VERIFIED) {
      await this.prisma.user.update({
        where: { id: verification.userId },
        data: {
          kycRejectionReason: null,
          kycAttemptCount: { increment: 1 },
          kycLastAttemptAt: new Date(),
        },
      });
    }

    return {
      processed: true,
      userId: verification.userId,
      verificationId: verification.id,
      kycStatus: userKycStatus,
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
          metadata: { step: 'kyc_pending', kycStatus },
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

  private resolveStatusFromSession(session: {
    status: 'pending' | 'verified' | 'rejected' | 'canceled';
    rawStatus: string;
    failureCode: string | null;
    failureReason: string | null;
    sessionId: string;
    sessionUrl: string | null;
  }): {
    verificationStatus: KycVerificationStatus;
    userKycStatus: KycStatus;
    completedAt: Date | null;
    failureReason: string | null;
  } {
    let verificationStatus: KycVerificationStatus = KycVerificationStatus.PENDING;
    let userKycStatus: KycStatus = KycStatus.PENDING;
    let completedAt: Date | null = null;
    let failureReason: string | null = null;

    if (session.status === 'verified') {
      verificationStatus = KycVerificationStatus.VERIFIED;
      userKycStatus = KycStatus.VERIFIED;
      completedAt = new Date();
    } else if (session.status === 'rejected') {
      verificationStatus = KycVerificationStatus.REJECTED;
      userKycStatus = KycStatus.REJECTED;
      completedAt = new Date();
      failureReason =
        session.failureCode ?? session.failureReason ?? 'rejected';
    } else if (session.status === 'canceled') {
      verificationStatus = KycVerificationStatus.CANCELED;
      userKycStatus = KycStatus.NOT_STARTED;
      completedAt = new Date();
      failureReason = 'canceled';
    }

    return { verificationStatus, userKycStatus, completedAt, failureReason };
  }
}
