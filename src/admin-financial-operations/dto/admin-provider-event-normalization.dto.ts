import { ApiProperty } from '@nestjs/swagger';

export class AdminProviderEventNormalizationDto {
  @ApiProperty()
  duplicatedIdempotencyKey!: boolean;

  @ApiProperty()
  missingExternalReference!: boolean;

  @ApiProperty()
  invalidLifecycleTransition!: boolean;

  @ApiProperty()
  orphanProviderEvent!: boolean;

  @ApiProperty()
  staleProcessing!: boolean;

  @ApiProperty()
  providerMismatch!: boolean;

  @ApiProperty()
  requiresManualReview!: boolean;

  @ApiProperty()
  summary!: string;
}