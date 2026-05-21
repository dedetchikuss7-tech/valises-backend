import { ApiProperty } from '@nestjs/swagger';

export class PayoutProviderEventNormalizationDto {
  @ApiProperty({
    description: 'Normalized provider event type',
    example: 'PAYOUT_PAID',
  })
  normalizedEventType!: string;

  @ApiProperty({
    description: 'Whether the event type is recognized',
    example: true,
  })
  recognized!: boolean;

  @ApiProperty({
    description: 'Whether the provider event can mutate payout state',
    example: true,
  })
  canMutateState!: boolean;

  @ApiProperty({
    description: 'Whether the provider event is terminal',
    example: false,
  })
  terminalEvent!: boolean;

  @ApiProperty({
    description: 'Whether the provider event should trigger reconciliation',
    example: false,
  })
  requiresReconciliation!: boolean;

  @ApiProperty({
    description: 'Human readable normalization summary',
    example:
      'Provider event normalized successfully and mapped to payout lifecycle.',
  })
  summary!: string;
}