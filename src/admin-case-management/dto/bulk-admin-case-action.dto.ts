import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdminCaseSourceType } from './list-admin-case-management-query.dto';

export class BulkAdminCaseActionItemDto {
  @ApiProperty({ enum: AdminCaseSourceType })
  @IsString()
  sourceType!: AdminCaseSourceType;

  @ApiProperty()
  @IsString()
  sourceId!: string;
}

export class BulkAdminCaseActionDto {
  @ApiProperty({ type: [BulkAdminCaseActionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAdminCaseActionItemDto)
  items!: BulkAdminCaseActionItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}