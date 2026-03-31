import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, TransactionStatus } from '@prisma/client';

export class RefundTransactionSummaryDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '7c79fd4d-2d7c-4b26-b98d-3cf7d08d0001',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction business status',
    enum: TransactionStatus,
    example: TransactionStatus.DISPUTED,
  })
  status!: TransactionStatus;

  @ApiProperty({
    description: 'Transaction payment status',
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS,
  })
  paymentStatus!: PaymentStatus;

  @ApiProperty({
    description: 'Current escrow amount on the transaction',
    example: 5000,
  })
  escrowAmount!: number;

  @ApiProperty({
    description: 'Sender user ID',
    example: '11d365f2-3d0f-4db9-a0f0-7c3b26d50001',
  })
  senderId!: string;

  @ApiProperty({
    description: 'Traveler user ID',
    example: '22d365f2-3d0f-4db9-a0f0-7c3b26d50002',
  })
  travelerId!: string;

  @ApiProperty({
    description: 'Transaction currency',
    example: 'XAF',
  })
  currency!: string;
}