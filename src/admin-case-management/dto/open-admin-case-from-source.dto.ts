import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AdminCaseSourceType } from './list-admin-case-management-query.dto';

export class OpenAdminCaseFromSourceDto {
  @ApiProperty({ enum: AdminCaseSourceType })
  @IsEnum(AdminCaseSourceType)
  sourceType!: AdminCaseSourceType;

  @ApiProperty()
  @IsString()
  sourceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}