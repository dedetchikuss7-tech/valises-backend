import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DisputeEvidenceItemKind } from '@prisma/client';

export class CreateDisputeEvidenceItemDto {
  @IsEnum(DisputeEvidenceItemKind)
  kind!: DisputeEvidenceItemKind;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsString()
  @MaxLength(255)
  storageKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}