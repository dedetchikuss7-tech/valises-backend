import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TripTicketUploadIntentResponseDto {
  @ApiProperty()
  tripId!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  storageKey!: string;

  @ApiProperty()
  uploadUrl!: string;

  @ApiProperty()
  method!: string;

  @ApiProperty({
    type: Object,
    additionalProperties: { type: 'string' },
  })
  headers!: Record<string, string>;

  @ApiProperty()
  expiresInSeconds!: number;

  @ApiProperty()
  uploadStatus!: string;

  @ApiPropertyOptional({ nullable: true })
  providerUploadId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  objectUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  publicUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  maxAllowedSizeBytes!: number | null;

  @ApiProperty({ type: [String] })
  allowedMimeTypes!: string[];

  @ApiProperty()
  nextStep!: string;
}