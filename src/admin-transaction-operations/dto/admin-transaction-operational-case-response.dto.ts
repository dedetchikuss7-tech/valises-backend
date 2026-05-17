import { ApiProperty } from '@nestjs/swagger';
import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
} from '@prisma/client';
import { AdminTransactionOperationalPriority } from './update-admin-transaction-operational-case.dto';
import { AdminTransactionOperationalResolutionCategory } from './resolve-admin-transaction-operational-case.dto';

export enum AdminTransactionOperationalResolutionStatus {
  UNRESOLVED = 'UNRESOLVED',
  RESOLVED = 'RESOLVED',
  REOPENED = 'REOPENED',
}

export class AdminTransactionOperationalCaseResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AdminOwnershipObjectType })
  objectType!: AdminOwnershipObjectType;

  @ApiProperty()
  transactionId!: string;

  @ApiProperty({ nullable: true })
  assignedAdminId!: string | null;

  @ApiProperty({ nullable: true })
  claimedAt!: Date | null;

  @ApiProperty({ nullable: true })
  releasedAt!: Date | null;

  @ApiProperty({ enum: AdminOwnershipOperationalStatus })
  operationalStatus!: AdminOwnershipOperationalStatus;

  @ApiProperty({ enum: AdminTransactionOperationalPriority })
  priority!: AdminTransactionOperationalPriority;

  @ApiProperty({ nullable: true })
  latestNote!: string | null;

  @ApiProperty({ nullable: true })
  latestActionCode!: string | null;

  @ApiProperty({ nullable: true })
  slaDueAt!: Date | null;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ enum: AdminTransactionOperationalResolutionStatus })
  operationalResolutionStatus!: AdminTransactionOperationalResolutionStatus;

  @ApiProperty({
    enum: AdminTransactionOperationalResolutionCategory,
    nullable: true,
  })
  operationalResolutionCategory!:
    | AdminTransactionOperationalResolutionCategory
    | null;

  @ApiProperty({ nullable: true })
  operationalResolutionCode!: string | null;

  @ApiProperty({ nullable: true })
  operationalResolutionSummary!: string | null;

  @ApiProperty({ nullable: true })
  operationalResolvedAt!: Date | null;

  @ApiProperty({ nullable: true })
  operationalResolvedById!: string | null;

  @ApiProperty({ nullable: true })
  operationalReopenedAt!: Date | null;

  @ApiProperty({ nullable: true })
  operationalReopenedById!: string | null;

  @ApiProperty({ nullable: true })
  operationalReopenReason!: string | null;

  @ApiProperty()
  metadata!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}