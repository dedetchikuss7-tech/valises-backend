import { IsEnum, IsInt, IsString, MaxLength, Min } from 'class-validator';
import { DisputeEvidenceItemKind } from '@prisma/client';

export class CreateDisputeEvidenceUploadIntentDto {
  @IsEnum(DisputeEvidenceItemKind)
  kind!: DisputeEvidenceItemKind;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}