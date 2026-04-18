import { ApiProperty } from '@nestjs/swagger';
import {
  LegalAcceptanceContext,
  LegalDocumentType,
} from '@prisma/client';

export class LegalAcceptanceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: LegalDocumentType })
  documentType!: LegalDocumentType;

  @ApiProperty()
  documentVersion!: string;

  @ApiProperty({ enum: LegalAcceptanceContext })
  context!: LegalAcceptanceContext;

  @ApiProperty({ nullable: true })
  transactionId!: string | null;

  @ApiProperty({ nullable: true })
  packageId!: string | null;

  @ApiProperty({ nullable: true, type: Object })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  acceptedAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}