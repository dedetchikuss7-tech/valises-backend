import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_KYC_ATTEMPTS = 3;

@Injectable()
export class KycRetryService {
  constructor(private readonly prisma: PrismaService) {}

  async retryKyc(userId: string): Promise<{ message: string; attemptCount: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
        kycAttemptCount: true,
      },
    });

    if (!user) throw new NotFoundException(`User not found: ${userId}`);

    if (user.kycStatus !== 'REJECTED') {
      throw new BadRequestException(
        `KYC retry is only available from REJECTED status. Current status: ${user.kycStatus}`,
      );
    }

    if ((user.kycAttemptCount ?? 0) >= MAX_KYC_ATTEMPTS) {
      throw new BadRequestException(
        `Maximum KYC attempts reached (${MAX_KYC_ATTEMPTS}). Contact support.`,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'PENDING',
        kycLastAttemptAt: new Date(),
      },
    });

    return {
      message: 'KYC status reset to PENDING. Please re-submit your documents.',
      attemptCount: (user.kycAttemptCount ?? 0) + 1,
    };
  }

  async getKycStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
        kycAttemptCount: true,
        kycRejectionReason: true,
        kycLastAttemptAt: true,
      },
    });

    if (!user) throw new NotFoundException(`User not found: ${userId}`);

    return {
      status: user.kycStatus,
      attemptCount: user.kycAttemptCount ?? 0,
      attemptsRemaining: Math.max(0, MAX_KYC_ATTEMPTS - (user.kycAttemptCount ?? 0)),
      rejectionReason: user.kycRejectionReason ?? null,
      lastAttemptAt: user.kycLastAttemptAt ?? null,
      canRetry: user.kycStatus === 'REJECTED' && (user.kycAttemptCount ?? 0) < MAX_KYC_ATTEMPTS,
    };
  }

  async adminOverrideKyc(
    targetUserId: string,
    adminUserId: string,
    newStatus: 'VERIFIED' | 'REJECTED',
    reason: string,
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('reason is required for KYC admin override.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException(`User not found: ${targetUserId}`);

    const previousStatus = user.kycStatus;

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        kycStatus: newStatus,
        kycRejectionReason: newStatus === 'REJECTED' ? reason : null,
        kycLastAttemptAt: new Date(),
      },
    });

    await this.prisma.adminActionAudit.create({
      data: {
        actorUserId: adminUserId,
        action: 'KYC_STATUS_OVERRIDE',
        targetType: 'USER',
        targetId: targetUserId,
        metadata: {
          previousStatus,
          newStatus,
          reason,
        },
      },
    });

    return {
      userId: targetUserId,
      previousStatus,
      newStatus,
      reason,
      overriddenBy: adminUserId,
      overriddenAt: new Date().toISOString(),
    };
  }
}
