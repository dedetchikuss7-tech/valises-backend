import { ApiProperty } from '@nestjs/swagger';
import { PayoutProvider } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class IngestPayoutProviderEventDto {
  @ApiProperty({
    description: 'Logical provider that emitted the event',
    enum: PayoutProvider,
    example: PayoutProvider.MANUAL,
  })
  @IsEnum(PayoutProvider)
  provider!: PayoutProvider;

  @ApiProperty({
    description:
      'Provider event type. Examples: payout.requested, payout.processing, payout.paid, payout.failed',
    example: 'payout.processing',
  })
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @ApiProperty({
    description:
      'Idempotency key for this provider event ingestion. Must be unique.',
    example: 'mock_stripe:event:po_12345',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiProperty({
    description: 'Internal payout UUID when known',
    example: '9f1aaf5d-3d2b-4d77-9d25-3a3a1f6ce8a2',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  payoutId?: string;

  @ApiProperty({
    description: 'Internal transaction UUID when known',
    example: '7de3cf76-f949-4bdb-aafc-8e7c8bbf3c31',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @ApiProperty({
    description: 'Provider external reference when known',
    example: 'mock_stripe_payout:po_12345',
    required: false,
  })
  @IsOptional()
  @IsString()
  externalReference?: string;

  @ApiProperty({
    description: 'Provider-side occurrence timestamp',
    example: '2026-04-18T12:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiProperty({
    description: 'Raw provider payload or normalized event payload',
    required: false,
    example: {
      providerStatus: 'processing',
      destination: 'traveler_mobile_money',
    },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}