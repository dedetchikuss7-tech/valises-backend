import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PspReconciliationCaseResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() reconciliationRunId: string | null;
  @ApiProperty() transactionId: string;
  @ApiPropertyOptional() payinProviderRef: string | null;
  @ApiProperty({ description: 'PSP_NOT_FOUND | PSP_STATUS_MISMATCH | AMOUNT_MISMATCH' })
  discrepancyType: string;
  @ApiProperty({ description: 'LOW | MEDIUM | HIGH | CRITICAL' }) severity: string;
  @ApiPropertyOptional() localStatus: string | null;
  @ApiPropertyOptional() pspStatus: string | null;
  @ApiPropertyOptional() localAmount: number | null;
  @ApiPropertyOptional() pspAmount: number | null;
  @ApiProperty() firstDetectedAt: Date;
  @ApiProperty() lastCheckedAt: Date;
  @ApiProperty() verificationAttempts: number;
  @ApiPropertyOptional() resolvedAt: Date | null;
  @ApiPropertyOptional() resolvedById: string | null;
  @ApiPropertyOptional() notes: string | null;
  @ApiPropertyOptional() metadata: Record<string, unknown> | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PspReconciliationRunResponseDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() initiatedById: string | null;
  @ApiProperty() startedAt: Date;
  @ApiPropertyOptional() completedAt: Date | null;
  @ApiProperty() dateFrom: Date;
  @ApiProperty() dateTo: Date;
  @ApiProperty() dryRun: boolean;
  @ApiProperty() totalChecked: number;
  @ApiProperty() verified: number;
  @ApiProperty() skipped: number;
  @ApiProperty() discrepanciesFound: number;
  @ApiProperty() provider: string;
  @ApiProperty({ description: 'RUNNING | COMPLETED | FAILED' }) status: string;
  @ApiPropertyOptional() errorMessage: string | null;
  @ApiPropertyOptional() metadata: Record<string, unknown> | null;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional({ type: () => [PspReconciliationCaseResponseDto] })
  cases?: PspReconciliationCaseResponseDto[];
}
