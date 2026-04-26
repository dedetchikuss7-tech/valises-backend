import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateTripTicketUploadIntentDto {
  @ApiProperty({
    example: 'flight-ticket.pdf',
    description: 'Original flight ticket file name',
  })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    example: 'application/pdf',
    description: 'Flight ticket MIME type',
  })
  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({
    example: 450000,
    minimum: 1,
    description: 'Flight ticket file size in bytes',
  })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}