import { ApiProperty } from '@nestjs/swagger';

export class DisputeEvidenceItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty()
  storageUrl!: string;

  @ApiProperty()
  uploadedById!: string;

  @ApiProperty()
  uploadedByRole!: string;

  @ApiProperty()
  uploadedAt!: Date;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty()
  isExpired!: boolean;

  @ApiProperty({ nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  validatedByAdmin!: boolean;

  @ApiProperty({ nullable: true })
  validatedByAdminId!: string | null;

  @ApiProperty({ nullable: true })
  validatedAt!: Date | null;

  @ApiProperty({ nullable: true })
  validationNote!: string | null;
}