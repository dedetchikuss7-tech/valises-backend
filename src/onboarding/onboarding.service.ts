import { Injectable, NotFoundException } from '@nestjs/common';
import { KycStatus, LegalAcceptanceContext, LegalDocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingStatusResponseDto } from './dto/onboarding-status-response.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string): Promise<OnboardingStatusResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, kycStatus: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const globalAcceptances = await this.prisma.legalAcceptance.findMany({
      where: { userId, context: LegalAcceptanceContext.GLOBAL },
      select: { documentType: true },
    });

    const kycCompleted = user.kycStatus === KycStatus.VERIFIED;

    const legalCompleted = globalAcceptances.some(
      (a) => a.documentType === LegalDocumentType.TERMS_OF_SERVICE,
    );

    const profileComplete = Boolean(user.email);

    const steps = [
      {
        key: 'KYC',
        completed: kycCompleted,
        required: true,
        nextStepUrl: '/kyc/me/session',
      },
      {
        key: 'LEGAL_TERMS',
        completed: legalCompleted,
        required: true,
        nextStepUrl: '/legal/acceptances/me',
      },
      {
        key: 'PROFILE_COMPLETE',
        completed: profileComplete,
        required: false,
        nextStepUrl: '/user/me',
      },
    ];

    const isReadyToTransact = kycCompleted && legalCompleted;

    const readinessBlockers: string[] = [];
    if (!kycCompleted) {
      readinessBlockers.push('KYC_NOT_VERIFIED');
    }
    if (!legalCompleted) {
      readinessBlockers.push('LEGAL_TERMS_NOT_ACCEPTED');
    }

    return {
      userId,
      kycStatus: user.kycStatus,
      steps,
      isReadyToTransact,
      readinessBlockers,
    };
  }
}
