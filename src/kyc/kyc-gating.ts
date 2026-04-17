import { KycStatus } from '@prisma/client';

export type KycRequirementErrorPayload = {
  code: 'KYC_REQUIRED';
  message: string;
  requiredFor: string;
  requiredKycStatus: KycStatus;
  nextStep: 'KYC';
  nextStepUrl: string;
  userId: string;
  kycStatus: KycStatus;
};

export function buildKycRequirementErrorPayload(input: {
  userId: string;
  kycStatus: KycStatus;
  requiredFor: string;
  message: string;
  nextStepUrl?: string;
}): KycRequirementErrorPayload {
  return {
    code: 'KYC_REQUIRED',
    message: input.message,
    requiredFor: input.requiredFor,
    requiredKycStatus: KycStatus.VERIFIED,
    nextStep: 'KYC',
    nextStepUrl: input.nextStepUrl ?? '/kyc',
    userId: input.userId,
    kycStatus: input.kycStatus,
  };
}