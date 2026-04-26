import { ApiProperty } from '@nestjs/swagger';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentType,
} from '@prisma/client';
import { IsEnum, IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateEvidenceUploadIntentDto {
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

  @ApiProperty({
    example: 'package-front.jpg',
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
    example: 450000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}