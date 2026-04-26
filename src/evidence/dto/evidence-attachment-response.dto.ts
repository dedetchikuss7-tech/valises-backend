import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentType,
  EvidenceAttachmentVisibility,
} from '@prisma/client';

export class EvidenceAttachmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: EvidenceAttachmentObjectType })
  targetType!: EvidenceAttachmentObjectType;

  @ApiProperty()
  targetId!: string;

  @ApiProperty({ enum: EvidenceAttachmentType })
  attachmentType!: EvidenceAttachmentType;

  @ApiProperty({ enum: EvidenceAttachmentStatus })
  status!: EvidenceAttachmentStatus;

  @ApiProperty({ enum: EvidenceAttachmentVisibility })
  visibility!: EvidenceAttachmentVisibility;

  @ApiProperty()
  uploadedById!: string;

  @ApiPropertyOptional({ nullable: true })
  reviewedByAdminId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  fileUrl!: string;

  @ApiPropertyOptional({ nullable: true })
  storageKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  fileName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  mimeType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sizeBytes!: number | null;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reviewNotes!: string | null;

  @ApiPropertyOptional({ nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}