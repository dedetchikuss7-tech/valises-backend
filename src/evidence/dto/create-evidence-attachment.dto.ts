import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentType,
  EvidenceAttachmentVisibility,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEvidenceAttachmentDto {
  @ApiProperty({
    enum: EvidenceAttachmentObjectType,
    example: EvidenceAttachmentObjectType.PACKAGE,
  })
  @IsEnum(EvidenceAttachmentObjectType)
  targetType!: EvidenceAttachmentObjectType;

  @ApiProperty({
    example: 'pkg-123',
  })
  @IsString()
  @MaxLength(120)
  targetId!: string;

  @ApiProperty({
    enum: EvidenceAttachmentType,
    example: EvidenceAttachmentType.PACKAGE_PHOTO,
  })
  @IsEnum(EvidenceAttachmentType)
  attachmentType!: EvidenceAttachmentType;

  @ApiPropertyOptional({
    enum: EvidenceAttachmentVisibility,
    default: EvidenceAttachmentVisibility.ADMIN_ONLY,
  })
  @IsOptional()
  @IsEnum(EvidenceAttachmentVisibility)
  visibility?: EvidenceAttachmentVisibility;

  @ApiProperty({
    example: 'Package front photo',
  })
  @IsString()
  @MaxLength(200)
  label!: string;

  @ApiProperty({
    description:
      'External or internal file URL/reference. Real upload storage is not implemented in this lot.',
    example: 'https://storage.example.com/evidence/pkg-123/front.jpg',
  })
  @IsString()
  @MaxLength(2000)
  fileUrl!: string;

  @ApiPropertyOptional({
    example: 'evidence/pkg-123/front.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string;

  @ApiPropertyOptional({
    example: 'front.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({
    example: 'image/jpeg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @ApiPropertyOptional({
    example: 240000,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @ApiPropertyOptional({
    description: 'Optional structured metadata for future storage/provider details',
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}