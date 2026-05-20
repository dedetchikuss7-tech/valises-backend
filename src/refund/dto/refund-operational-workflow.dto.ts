import { ApiProperty } from '@nestjs/swagger';

export class RefundOperationalWorkflowDto {
  @ApiProperty({
    description: 'Current operational workflow step',
    example: 'PROVIDER_PROCESSING',
  })
  currentStep!: string;

  @ApiProperty({
    description: 'Recommended next admin action',
    example: 'WAIT_PROVIDER_CALLBACK',
  })
  nextRecommendedAction!: string;

  @ApiProperty({
    description: 'Optional blocking reason',
    example: 'Provider callback still pending',
    nullable: true,
  })
  blockingReason!: string | null;

  @ApiProperty({
    description: 'Operational priority level',
    example: 'HIGH',
  })
  operationalPriority!: string;

  @ApiProperty({
    description: 'Whether escalation is recommended',
    example: true,
  })
  requiresEscalation!: boolean;

  @ApiProperty({
    description: 'Whether refund retry is currently allowed',
    example: false,
  })
  canRetry!: boolean;

  @ApiProperty({
    description: 'Whether mark refunded action is currently allowed',
    example: true,
  })
  canMarkRefunded!: boolean;

  @ApiProperty({
    description: 'Whether mark failed action is currently allowed',
    example: true,
  })
  canMarkFailed!: boolean;

  @ApiProperty({
    description: 'Whether provider event reconciliation is allowed',
    example: true,
  })
  canReconcileProviderEvents!: boolean;

  @ApiProperty({
    description: 'Human-readable workflow summary',
    example:
      'Refund is processing with provider callback still pending.',
  })
  summary!: string;
}