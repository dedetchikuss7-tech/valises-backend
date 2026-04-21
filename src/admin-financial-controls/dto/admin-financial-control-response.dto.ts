import { ApiProperty } from '@nestjs/swagger';
import { AdminFinancialControlStatus } from './list-admin-financial-controls-query.dto';

export class AdminFinancialControlResponseDto {
  @ApiProperty()
  transactionId!: string;

  @ApiProperty({ enum: AdminFinancialControlStatus })
  derivedStatus!: AdminFinancialControlStatus;

  @ApiProperty()
  requiresAction!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  updatedAt!: Date | null;

  @ApiProperty({ nullable: true })
  senderId!: string | null;

  @ApiProperty({ nullable: true })
  travelerId!: string | null;

  @ApiProperty()
  transactionStatus!: string;

  @ApiProperty()
  paymentStatus!: string;

  @ApiProperty()
  transactionAmount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  ledgerCreditedAmount!: number;

  @ApiProperty()
  ledgerReleasedAmount!: number;

  @ApiProperty()
  ledgerRefundedAmount!: number;

  @ApiProperty()
  payoutPaidAmount!: number;

  @ApiProperty()
  refundPaidAmount!: number;

  @ApiProperty()
  remainingEscrowAmount!: number;

  @ApiProperty({ type: [String] })
  mismatchSignals!: string[];

  @ApiProperty({
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;
}