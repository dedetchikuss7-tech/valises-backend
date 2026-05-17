import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AdminTransactionOperationalResolutionCategory {
  DISPUTE_REVIEWED = 'DISPUTE_REVIEWED',
  EVIDENCE_REVIEWED = 'EVIDENCE_REVIEWED',
  DELIVERY_VALIDATED = 'DELIVERY_VALIDATED',
  PAYOUT_MONITORED = 'PAYOUT_MONITORED',
  REFUND_MONITORED = 'REFUND_MONITORED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  MANUAL_OPS_RESOLUTION = 'MANUAL_OPS_RESOLUTION',
  OTHER = 'OTHER',
}

export class ResolveAdminTransactionOperationalCaseDto {
  @ApiProperty({
    enum: AdminTransactionOperationalResolutionCategory,
    description: 'Operational resolution category selected by the admin',
  })
  @IsEnum(AdminTransactionOperationalResolutionCategory)
  resolutionCategory!: AdminTransactionOperationalResolutionCategory;

  @ApiProperty({
    description: 'Short human-readable operational resolution summary',
    example: 'Delivery proof reviewed and accepted. No further ops action required.',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  resolutionSummary!: string;

  @ApiPropertyOptional({
    description: 'Optional machine-readable resolution code',
    example: 'DELIVERY_PROOF_VALIDATED',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resolutionCode?: string;

  @ApiPropertyOptional({
    description: 'Optional structured metadata',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}