import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
} from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkAdminWorkloadActionItemDto {
  @ApiProperty({ enum: AdminOwnershipObjectType })
  @IsEnum(AdminOwnershipObjectType)
  objectType!: AdminOwnershipObjectType;

  @ApiProperty()
  @IsString()
  objectId!: string;
}

export class BulkAdminWorkloadActionDto {
  @ApiProperty({ type: [BulkAdminWorkloadActionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAdminWorkloadActionItemDto)
  items!: BulkAdminWorkloadActionItemDto[];

  @ApiPropertyOptional({
    description: 'Optional admin note applied to every item',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Optional SLA due date applied to every item when relevant',
    example: '2099-01-01T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  slaDueAt?: string;
}

export class BulkAdminWorkloadStatusActionDto extends BulkAdminWorkloadActionDto {
  @ApiProperty({ enum: AdminOwnershipOperationalStatus })
  @IsEnum(AdminOwnershipOperationalStatus)
  operationalStatus!: AdminOwnershipOperationalStatus;
}