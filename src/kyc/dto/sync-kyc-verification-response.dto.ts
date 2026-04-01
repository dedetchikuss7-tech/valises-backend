import { ApiProperty } from '@nestjs/swagger';
import {
  KycProvider,
  KycStatus,
  KycVerificationStatus,
} from '@prisma/client';

export class SyncKycVerificationResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'e243bcc1-38bf-4722-86ac-aa7119eee4a7',
  })
  userId!: string;

  @ApiProperty({
    description: 'Local KYC verification ID',
    example: '7d0c6718-6a2a-4f8e-9bb4-c8a47d6e9001',
  })
  verificationId!: string;

  @ApiProperty({
    description: 'KYC provider',
    enum: KycProvider,
    example: KycProvider.STRIPE_IDENTITY,
  })
  provider!: KycProvider;

  @ApiProperty({
    description: 'Local verification status after synchronization',
    enum: KycVerificationStatus,
    example: KycVerificationStatus.VERIFIED,
  })
  verificationStatus!: KycVerificationStatus;

  @ApiProperty({
    description: 'Raw provider status after synchronization',
    example: 'verified',
  })
  providerStatus!: string;

  @ApiProperty({
    description: 'Current user KYC status after synchronization',
    enum: KycStatus,
    example: KycStatus.VERIFIED,
  })
  userKycStatus!: KycStatus;

  @ApiProperty({
    description: 'Failure reason when provider says the session requires input',
    example: 'document_unverified_other',
    nullable: true,
  })
  failureReason!: string | null;

  @ApiProperty({
    description: 'Completion timestamp when verification is finished',
    example: '2026-04-01T12:02:00.000Z',
    nullable: true,
  })
  completedAt!: Date | null;
}