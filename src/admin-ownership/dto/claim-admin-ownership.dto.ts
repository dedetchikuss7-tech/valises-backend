import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminOwnershipObjectType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ClaimAdminOwnershipDto {
  @ApiProperty({ enum: AdminOwnershipObjectType })
  @IsEnum(AdminOwnershipObjectType)
  objectType!: AdminOwnershipObjectType;

  @ApiProperty()
  @IsString()
  objectId!: string;

  @ApiPropertyOptional({
    description: 'Optional SLA due date for this admin ownership item',
    example: '2099-01-01T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  slaDueAt?: string;

  @ApiPropertyOptional({
    description: 'Optional admin note attached to the claim action',
  })
  @IsOptional()
  @IsString()
  note?: string;
}