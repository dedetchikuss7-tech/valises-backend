import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminOwnershipOperationalStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AdminTransactionOperationalPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class UpdateAdminTransactionOperationalCaseDto {
  @ApiPropertyOptional({
    enum: AdminOwnershipOperationalStatus,
    description:
      'Operational status backed by AdminOwnership. Use IN_REVIEW for manual review, WAITING_EXTERNAL for external follow-up, DONE for resolved cases.',
  })
  @IsOptional()
  @IsEnum(AdminOwnershipOperationalStatus)
  operationalStatus?: AdminOwnershipOperationalStatus;

  @ApiPropertyOptional({
    enum: AdminTransactionOperationalPriority,
    description: 'Operational priority stored in AdminOwnership metadata.',
  })
  @IsOptional()
  @IsEnum(AdminTransactionOperationalPriority)
  priority?: AdminTransactionOperationalPriority;

  @ApiPropertyOptional({
    description: 'Admin user id to assign the transaction operational case to.',
  })
  @IsOptional()
  @IsString()
  assignedAdminId?: string;

  @ApiPropertyOptional({
    description: 'Operational note appended to the case metadata and timeline.',
    maxLength: 1500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  note?: string;

  @ApiPropertyOptional({
    description: 'Machine-readable action code for the operational update.',
    example: 'REQUEST_EVIDENCE_RESUBMISSION',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  actionCode?: string;

  @ApiPropertyOptional({
    description: 'Optional structured metadata merged into the operational case.',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}