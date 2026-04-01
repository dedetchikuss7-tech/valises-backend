import { ApiProperty } from '@nestjs/swagger';

export class GenerateDeliveryCodeResponseDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'a1b53644-ca2d-4d26-abe4-24e381049cb9',
  })
  transactionId!: string;

  @ApiProperty({
    description: 'One-time 6-digit delivery code to be shared securely',
    example: '482193',
  })
  code!: string;

  @ApiProperty({
    description: 'Timestamp when the code was generated',
    example: '2026-04-01T10:00:00.000Z',
  })
  generatedAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the code expires',
    example: '2026-04-08T10:00:00.000Z',
  })
  expiresAt!: Date;
}