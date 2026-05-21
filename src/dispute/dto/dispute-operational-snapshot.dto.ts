import { ApiProperty } from '@nestjs/swagger';
import { DisputeEvidenceItemDto } from './dispute-evidence-item.dto';

export class DisputeOperationalSnapshotDto {
  @ApiProperty({
    example: true,
  })
  hasEvidence!: boolean;

  @ApiProperty({
    example: 2,
  })
  totalEvidenceCount!: number;

  @ApiProperty({
    example: 1,
  })
  pendingEvidenceReviewCount!: number;

  @ApiProperty({
    example: true,
  })
  hasExpiredEvidence!: boolean;

  @ApiProperty({
    example: false,
  })
  requiresImmediateAdminAttention!: boolean;

  @ApiProperty({
    type: () => [DisputeEvidenceItemDto],
  })
  evidence!: DisputeEvidenceItemDto[];
}