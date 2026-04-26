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

export class ConfirmEvidenceUploadDto {
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
      'Storage key returned by POST /evidence/upload-intents after client upload.',
    example:
      'pending/evidence/package/pkg-1/package_photo/user-1/2026-04-26T10-00-00-000Z-front.jpg',
  })
  @IsString()
  @MaxLength(1000)
  storageKey!: string;

  @ApiProperty({
    example: 'front.jpg',
  })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    example: 'image/jpeg',
  })
  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({
    example: 240000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @ApiPropertyOptional({
    description:
      'Optional structured metadata to store on the EvidenceAttachment record',
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}