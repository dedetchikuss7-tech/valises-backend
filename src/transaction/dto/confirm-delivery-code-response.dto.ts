import { ApiProperty } from '@nestjs/swagger';
import { PayoutStatus, TransactionStatus } from '@prisma/client';

export class ConfirmDeliveryCodeResponseDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'a1b53644-ca2d-4d26-abe4-24e381049cb9',
  })
  transactionId!: string;

  @ApiProperty({
    description: 'Transaction status after successful confirmation',
    enum: TransactionStatus,
    example: TransactionStatus.DELIVERED,
  })
  status!: TransactionStatus;

  @ApiProperty({
    description: 'Timestamp when delivery was confirmed',
    example: '2026-04-01T12:00:00.000Z',
  })
  deliveryConfirmedAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the delivery code was consumed',
    example: '2026-04-01T12:00:00.000Z',
  })
  deliveryCodeConsumedAt!: Date;

  @ApiProperty({
    description:
      'Whether a payout request was triggered automatically after delivery confirmation',
    example: true,
  })
  payoutRequestTriggered!: boolean;

  @ApiProperty({
    description: 'Payout ID when a payout request exists',
    example: 'po_123',
    nullable: true,
  })
  payoutId!: string | null;

  @ApiProperty({
    description: 'Payout status after the automatic request',
    enum: PayoutStatus,
    example: PayoutStatus.REQUESTED,
    nullable: true,
  })
  payoutStatus!: PayoutStatus | null;
}