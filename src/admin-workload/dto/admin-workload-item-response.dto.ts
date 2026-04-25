import { ApiProperty } from '@nestjs/swagger';
import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
} from '@prisma/client';

export class AdminWorkloadItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AdminOwnershipObjectType })
  objectType!: AdminOwnershipObjectType;

  @ApiProperty()
  objectId!: string;

  @ApiProperty({ nullable: true })
  assignedAdminId!: string | null;

  @ApiProperty({ nullable: true })
  claimedAt!: Date | null;

  @ApiProperty({ nullable: true })
  releasedAt!: Date | null;

  @ApiProperty({ enum: AdminOwnershipOperationalStatus })
  operationalStatus!: AdminOwnershipOperationalStatus;

  @ApiProperty({ nullable: true })
  slaDueAt!: Date | null;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  ageMinutes!: number;

  @ApiProperty()
  isOpen!: boolean;

  @ApiProperty()
  isOverdue!: boolean;

  @ApiProperty()
  isDueSoon!: boolean;

  @ApiProperty({ nullable: true })
  timeToSlaMinutes!: number | null;
}