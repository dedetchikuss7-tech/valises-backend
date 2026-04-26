import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvidenceAttachmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewEvidenceAttachmentDto {
  @ApiProperty({
    enum: EvidenceAttachmentStatus,
    example: EvidenceAttachmentStatus.ACCEPTED,
  })
  @IsEnum(EvidenceAttachmentStatus)
  status!: EvidenceAttachmentStatus;

  @ApiPropertyOptional({
    example: 'Evidence accepted after admin review.',
    nullable: true,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;

  @ApiPropertyOptional({
    example: 'Image is blurry or does not match the target object.',
    nullable: true,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}