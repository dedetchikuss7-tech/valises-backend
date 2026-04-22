import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdminReconciliationCaseType } from './list-admin-reconciliation-cases-query.dto';

export class BulkAdminReconciliationReviewItemDto {
  @ApiProperty({ enum: AdminReconciliationCaseType })
  @IsString()
  caseType!: AdminReconciliationCaseType;

  @ApiProperty()
  @IsString()
  caseId!: string;
}

export class BulkAdminReconciliationReviewDto {
  @ApiProperty({ type: [BulkAdminReconciliationReviewItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAdminReconciliationReviewItemDto)
  items!: BulkAdminReconciliationReviewItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}