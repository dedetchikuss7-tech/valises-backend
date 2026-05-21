import { ApiProperty } from '@nestjs/swagger';

export class RefundProviderEventNormalizationDto {
  @ApiProperty({ example: 'REFUND_REFUNDED' })
  normalizedEventType!: string;

  @ApiProperty({ example: true })
  recognized!: boolean;

  @ApiProperty({ example: true })
  canMutateState!: boolean;

  @ApiProperty({ example: false })
  terminalEvent!: boolean;

  @ApiProperty({ example: false })
  requiresReconciliation!: boolean;

  @ApiProperty({
    example: 'Refund provider event normalized successfully.',
  })
  summary!: string;
}