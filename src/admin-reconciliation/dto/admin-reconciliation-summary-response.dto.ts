import { ApiProperty } from '@nestjs/swagger';

export class AdminReconciliationSummaryResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalPayoutRows!: number;

  @ApiProperty()
  totalRefundRows!: number;

  @ApiProperty()
  pendingRows!: number;

  @ApiProperty()
  failedRows!: number;

  @ApiProperty()
  mismatchRows!: number;

  @ApiProperty()
  requiresActionCount!: number;
}