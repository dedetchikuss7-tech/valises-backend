import { IsInt, IsOptional, Min } from 'class-validator';

export class ConfirmDisputeEvidenceUploadDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  uploadedSizeBytes?: number;
}