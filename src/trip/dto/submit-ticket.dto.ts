import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SubmitTicketDto {
  @ApiPropertyOptional({
    description: 'Optional airline booking reference or ticket reference',
    example: 'AF-ABC123',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ticketRef?: string;

  @ApiProperty({
    description: 'Storage provider returned by upload intent',
    example: 'MOCK_STORAGE',
  })
  @IsString()
  @MaxLength(80)
  provider!: string;

  @ApiPropertyOptional({
    description: 'Provider upload identifier when returned by storage provider',
    example: 'mock-upload:pending/trips/trip1/flight-ticket/file.pdf',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  providerUploadId?: string;

  @ApiProperty({
    description: 'Storage key returned by upload intent',
    example: 'pending/trips/trip1/flight-ticket/user1/flight-ticket.pdf',
  })
  @IsString()
  @MaxLength(1000)
  storageKey!: string;

  @ApiPropertyOptional({
    description: 'Object URL returned by storage provider',
    example: 'https://mock-storage.local/object/...',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  objectUrl?: string;

  @ApiPropertyOptional({
    description: 'Public URL if the storage provider returns one',
    example: null,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  publicUrl?: string;

  @ApiProperty({
    description: 'Original ticket file name',
    example: 'flight-ticket.pdf',
  })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    description: 'Ticket MIME type',
    example: 'application/pdf',
  })
  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({
    description: 'Ticket file size in bytes',
    example: 450000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}