import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkAdminFinancialControlReviewItemDto {
  @ApiProperty()
  @IsString()
  transactionId!: string;
}

export class BulkAdminFinancialControlReviewDto {
  @ApiProperty({ type: [BulkAdminFinancialControlReviewItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAdminFinancialControlReviewItemDto)
  items!: BulkAdminFinancialControlReviewItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}