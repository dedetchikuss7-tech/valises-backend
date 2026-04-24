import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminOwnershipObjectType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReleaseAdminOwnershipDto {
  @ApiProperty({ enum: AdminOwnershipObjectType })
  @IsEnum(AdminOwnershipObjectType)
  objectType!: AdminOwnershipObjectType;

  @ApiProperty()
  @IsString()
  objectId!: string;

  @ApiPropertyOptional({
    description: 'Optional admin note attached to the release action',
  })
  @IsOptional()
  @IsString()
  note?: string;
}