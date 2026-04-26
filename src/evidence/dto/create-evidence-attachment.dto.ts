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

  @ApiPropertyOptional({
    description:
      'Backward-compatible file URL/reference. Prefer objectUrl/publicUrl/storageKey from upload intent when available.',
    example: 'https://storage.example.com/evidence/pkg-123/front.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fileUrl?: string;

  @ApiPropertyOptional({
    description: 'Storage provider returned by upload intent',
    example: 'MOCK_STORAGE',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @ApiPropertyOptional({
    description: 'Provider upload identifier returned by upload intent',
    example: 'mock-upload:pending/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  providerUploadId?: string;

  @ApiPropertyOptional({
    description: 'Storage key returned by upload intent',
    example: 'pending/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  storageKey?: string;

  @ApiPropertyOptional({
    description: 'Object URL returned by storage provider',
    example: 'https://mock-storage.local/object/...',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  objectUrl?: string;

  @ApiPropertyOptional({
    description: 'Public URL returned by storage provider when available',
    example: null,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  publicUrl?: string;

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