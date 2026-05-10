import { ApiProperty } from '@nestjs/swagger';
import {
  AdminOwnershipOperationalStatus,
  AdminOwnershipObjectType,
} from '@prisma/client';
import { AdminTransactionOperationalPriority } from './update-admin-transaction-operational-case.dto';

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

  @ApiProperty({ additionalProperties: true, nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}