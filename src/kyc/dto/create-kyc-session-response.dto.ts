import { ApiProperty } from '@nestjs/swagger';
import {
  KycProvider,
  KycStatus,
  KycVerificationStatus,
} from '@prisma/client';

export class CreateKycSessionResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'e243bcc1-38bf-4722-86ac-aa7119eee4a7',
  })
  userId!: string;

  @ApiProperty({
    description: 'Current user KYC status after session creation',
    enum: KycStatus,
    example: KycStatus.PENDING,
  })
  kycStatus!: KycStatus;

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
    description: 'Local verification status',
    enum: KycVerificationStatus,
    example: KycVerificationStatus.PENDING,
  })
  verificationStatus!: KycVerificationStatus;

  @ApiProperty({
    description: 'Stripe verification session ID',
    example: 'vs_1NuN4zLkdIwHu7ixleE6HvkI',
  })
  providerSessionId!: string;

  @ApiProperty({
    description: 'Stripe hosted verification URL',
    example: 'https://verify.stripe.com/.../vs_123',
    nullable: true,
  })
  providerSessionUrl!: string | null;

  @ApiProperty({
    description: 'Timestamp when the verification was requested',
    example: '2026-04-01T12:00:00.000Z',
  })
  requestedAt!: Date;
}