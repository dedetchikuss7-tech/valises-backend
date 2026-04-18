import { ApiProperty } from '@nestjs/swagger';
import { ProviderEventObjectType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class IngestProviderWebhookEventDto {
  @ApiProperty({
    description: 'Logical provider name carried by the webhook event',
    example: 'MOCK_STRIPE',
  })
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiProperty({
    description: 'Target object type resolved from the webhook event',
    enum: ProviderEventObjectType,
    example: ProviderEventObjectType.PAYOUT,
  })
  @IsEnum(ProviderEventObjectType)
  objectType!: ProviderEventObjectType;

  @ApiProperty({
    description:
      'Provider event type. Examples: payout.processing, payout.paid, refund.processing, refund.refunded',
    example: 'payout.processing',
  })
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @ApiProperty({
    description:
      'Unique idempotency key for this webhook event ingestion. Usually derived from provider event id or delivery id.',
    example: 'mock_stripe:webhook:evt_12345',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiProperty({
    description: 'Internal transaction UUID when known',
    required: false,
    example: '7de3cf76-f949-4bdb-aafc-8e7c8bbf3c31',
  })
  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @ApiProperty({
    description: 'Internal payout UUID when known',
    required: false,
    example: '9f1aaf5d-3d2b-4d77-9d25-3a3a1f6ce8a2',
  })
  @IsOptional()
  @IsUUID()
  payoutId?: string;

  @ApiProperty({
    description: 'Internal refund UUID when known',
    required: false,
    example: '9f1aaf5d-3d2b-4d77-9d25-3a3a1f6ce8a2',
  })
  @IsOptional()
  @IsUUID()
  refundId?: string;

  @ApiProperty({
    description: 'Provider external reference when known',
    required: false,
    example: 'mock_stripe_ref:po_12345',
  })
  @IsOptional()
  @IsString()
  externalReference?: string;

  @ApiProperty({
    description: 'Provider-side occurrence timestamp',
    required: false,
    example: '2026-04-18T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiProperty({
    description: 'Normalized or raw webhook payload body',
    required: false,
    example: {
      providerStatus: 'processing',
      amount: 1000,
    },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}