import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
} from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateAdminOwnershipStatusDto {
  @ApiProperty({ enum: AdminOwnershipObjectType })
  @IsEnum(AdminOwnershipObjectType)
  objectType!: AdminOwnershipObjectType;

  @ApiProperty()
  @IsString()
  objectId!: string;

  @ApiProperty({ enum: AdminOwnershipOperationalStatus })
  @IsEnum(AdminOwnershipOperationalStatus)
  operationalStatus!: AdminOwnershipOperationalStatus;

  @ApiPropertyOptional({
    description: 'Optional SLA due date update',
    example: '2099-01-01T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  slaDueAt?: string;

  @ApiPropertyOptional({
    description: 'Optional admin note attached to the status update',
  })
  @IsOptional()
  @IsString()
  note?: string;
}