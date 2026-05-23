import { ApiProperty } from '@nestjs/swagger';

export class FinanceSummaryDto {
  @ApiProperty()
  totalEscrow: number;

  @ApiProperty()
  totalPaid: number;

  @ApiProperty()
  totalPendingPayouts: number;

  @ApiProperty()
  totalPaidOut: number;

  @ApiProperty()
  totalRefunded: number;

  @ApiProperty()
  platformRevenue: number;

  @ApiProperty()
  transactionCount: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  byStatus: Record<string, number>;

  @ApiProperty()
  generatedAt: Date;
}

export class OrphanTransactionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  senderId: string;

  @ApiProperty()
  travelerId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  escrowAmount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  paymentStatus: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  paymentConfirmedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  ageHours: number;
}

export class BalanceMismatchDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  senderId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  escrowAmount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  paymentStatus: string;

  @ApiProperty()
  diff: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PspReconciliationRowDto {
  @ApiProperty()
  transactionId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  paymentStatus: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  escrowAmount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  paymentConfirmedAt: Date | null;

  @ApiProperty({ nullable: true })
  payoutId: string | null;

  @ApiProperty({ nullable: true })
  payoutStatus: string | null;

  @ApiProperty({ nullable: true })
  payoutAmount: number | null;

  @ApiProperty({ nullable: true })
  payoutPaidAt: Date | null;

  @ApiProperty({ nullable: true })
  refundId: string | null;

  @ApiProperty({ nullable: true })
  refundStatus: string | null;

  @ApiProperty({ nullable: true })
  refundAmount: number | null;

  @ApiProperty({ nullable: true })
  refundedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class PspReconciliationReportDto {
  @ApiProperty()
  dateFrom: string;

  @ApiProperty()
  dateTo: string;

  @ApiProperty()
  rowCount: number;

  @ApiProperty({ type: () => [PspReconciliationRowDto] })
  rows: PspReconciliationRowDto[];

  @ApiProperty()
  generatedAt: Date;
}
