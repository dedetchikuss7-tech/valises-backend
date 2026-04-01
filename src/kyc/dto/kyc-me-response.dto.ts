import { ApiProperty } from '@nestjs/swagger';
import {
  KycProvider,
  KycStatus,
  KycVerificationStatus,
} from '@prisma/client';

export class KycMeResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'e243bcc1-38bf-4722-86ac-aa7119eee4a7',
  })
  userId!: string;

  @ApiProperty({
    description: 'Current user KYC status',
    enum: KycStatus,
    example: KycStatus.NOT_STARTED,
  })
  kycStatus!: KycStatus;

  @ApiProperty({
    description: 'Latest local KYC verification ID when one exists',
    example: '7d0c6718-6a2a-4f8e-9bb4-c8a47d6e9001',
    nullable: true,
  })
  latestVerificationId!: string | null;

  @ApiProperty({
    description: 'Latest provider used when one exists',
    enum: KycProvider,
    example: KycProvider.STRIPE_IDENTITY,
    nullable: true,
  })
  latestProvider!: KycProvider | null;

  @ApiProperty({
    description: 'Latest local verification status when one exists',
    enum: KycVerificationStatus,
    example: KycVerificationStatus.PENDING,
    nullable: true,
  })
  latestVerificationStatus!: KycVerificationStatus | null;

  @ApiProperty({
    description: 'Latest provider session ID when one exists',
    example: 'vs_1NuN4zLkdIwHu7ixleE6HvkI',
    nullable: true,
  })
  latestProviderSessionId!: string | null;

  @ApiProperty({
    description: 'Latest provider session URL when one exists',
    example: 'https://verify.stripe.com/.../vs_123',
    nullable: true,
  })
  latestProviderSessionUrl!: string | null;

  @ApiProperty({
    description: 'Latest failure reason when one exists',
    example: 'document_unverified_other',
    nullable: true,
  })
  latestFailureReason!: string | null;

  @ApiProperty({
    description: 'Latest verification requested timestamp',
    example: '2026-04-01T12:00:00.000Z',
    nullable: true,
  })
  latestRequestedAt!: Date | null;

  @ApiProperty({
    description: 'Latest verification completion timestamp',
    example: '2026-04-01T12:02:00.000Z',
    nullable: true,
  })
  latestCompletedAt!: Date | null;
}