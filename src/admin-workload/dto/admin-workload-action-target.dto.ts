import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminOwnershipObjectType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class AdminWorkloadActionTargetDto {
  @ApiProperty({ enum: AdminOwnershipObjectType })
  @IsEnum(AdminOwnershipObjectType)
  objectType!: AdminOwnershipObjectType;

  @ApiProperty()
  @IsString()
  objectId!: string;

  @ApiPropertyOptional({
    description: 'Optional admin note attached to the workload action',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Optional SLA due date for claim/status actions',
    example: '2099-01-01T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  slaDueAt?: string;
}