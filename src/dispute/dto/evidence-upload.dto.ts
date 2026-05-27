import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EvidenceFileKind {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
}

export class RequestEvidenceUploadDto {
  @ApiProperty({ description: 'Original filename with extension' })
  @IsString()
  filename: string;

  @ApiProperty({ enum: EvidenceFileKind })
  @IsEnum(EvidenceFileKind)
  kind: EvidenceFileKind;
}
