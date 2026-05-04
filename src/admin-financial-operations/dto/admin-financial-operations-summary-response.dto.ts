import { ApiProperty } from '@nestjs/swagger';

export class AdminFinancialOperationsSummaryResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  highPriorityCount!: number;

  @ApiProperty()
  mediumPriorityCount!: number;

  @ApiProperty()
  lowPriorityCount!: number;

  @ApiProperty()
  requiresActionCount!: number;

  @ApiProperty()
  payoutItems!: number;

  @ApiProperty()
  refundItems!: number;

  @ApiProperty()
  financialControlItems!: number;
}