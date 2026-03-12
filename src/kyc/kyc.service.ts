import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AbandonmentKind, KycStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abandonment: AbandonmentService,
  ) {}

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
}