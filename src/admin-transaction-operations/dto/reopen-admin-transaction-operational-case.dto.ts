import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReopenAdminTransactionOperationalCaseDto {
  @ApiProperty({
    description: 'Reason explaining why the operational case is reopened',
    example: 'New dispute evidence was received after case resolution.',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Optional machine-readable reopen code',
    example: 'NEW_EVIDENCE_RECEIVED',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reopenCode?: string;

  @ApiPropertyOptional({
    description: 'Optional structured metadata',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}