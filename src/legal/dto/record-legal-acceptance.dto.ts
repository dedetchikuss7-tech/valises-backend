import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LegalAcceptanceContext,
  LegalDocumentType,
} from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RecordLegalAcceptanceDto {
  @ApiProperty({ enum: LegalDocumentType })
  @IsEnum(LegalDocumentType)
  documentType!: LegalDocumentType;

  @ApiProperty({
    description: 'Accepted document version',
    example: 'v1',
  })
  @IsString()
  @MaxLength(100)
  documentVersion!: string;

  @ApiProperty({ enum: LegalAcceptanceContext })
  @IsEnum(LegalAcceptanceContext)
  context!: LegalAcceptanceContext;

  @ApiPropertyOptional({
    description: 'Optional transaction UUID when context is TRANSACTION',
  })
  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Optional package UUID when context is PACKAGE',
  })
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ApiPropertyOptional({
    description: 'Optional metadata stored with the acceptance',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}