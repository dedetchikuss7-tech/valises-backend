import { ApiProperty } from '@nestjs/swagger';
import { RefundResponseDto } from './refund-response.dto';
import { RefundTransactionSummaryDto } from './refund-transaction-summary.dto';

export class RefundWithTransactionResponseDto extends RefundResponseDto {
  @ApiProperty({
    description: 'Linked transaction summary',
    type: RefundTransactionSummaryDto,
  })
  transaction!: RefundTransactionSummaryDto;
}