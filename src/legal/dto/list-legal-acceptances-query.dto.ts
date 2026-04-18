import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  LegalAcceptanceContext,
  LegalDocumentType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListLegalAcceptancesQueryDto {
  @ApiPropertyOptional({ enum: LegalDocumentType })
  @IsOptional()
  @IsEnum(LegalDocumentType)
  documentType?: LegalDocumentType;

  @ApiPropertyOptional({ enum: LegalAcceptanceContext })
  @IsOptional()
  @IsEnum(LegalAcceptanceContext)
  context?: LegalAcceptanceContext;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}