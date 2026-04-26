import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentType,
  EvidenceAttachmentVisibility,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  EvidenceAttachmentSortBy,
  SortOrder,
} from './list-evidence-attachments-query.dto';

export class ListEvidenceAdminReviewQueueQueryDto {
  @ApiPropertyOptional({
    enum: EvidenceAttachmentStatus,
    default: EvidenceAttachmentStatus.PENDING_REVIEW,
    description:
      'Evidence status to show in the admin review queue. Defaults to PENDING_REVIEW.',
  })
  @IsOptional()
  @IsEnum(EvidenceAttachmentStatus)
  status?: EvidenceAttachmentStatus = EvidenceAttachmentStatus.PENDING_REVIEW;

  @ApiPropertyOptional({ enum: EvidenceAttachmentObjectType })
  @IsOptional()
  @IsEnum(EvidenceAttachmentObjectType)
  targetType?: EvidenceAttachmentObjectType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ enum: EvidenceAttachmentType })
  @IsOptional()
  @IsEnum(EvidenceAttachmentType)
  attachmentType?: EvidenceAttachmentType;

  @ApiPropertyOptional({ enum: EvidenceAttachmentVisibility })
  @IsOptional()
  @IsEnum(EvidenceAttachmentVisibility)
  visibility?: EvidenceAttachmentVisibility;

  @ApiPropertyOptional({
    description: 'Filter by uploader user id',
  })
  @IsOptional()
  @IsString()
  uploadedById?: string;

  @ApiPropertyOptional({
    description: 'Free-text search across label, target id, file name, mime type and url',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: EvidenceAttachmentSortBy,
    default: EvidenceAttachmentSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(EvidenceAttachmentSortBy)
  sortBy?: EvidenceAttachmentSortBy = EvidenceAttachmentSortBy.CREATED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}