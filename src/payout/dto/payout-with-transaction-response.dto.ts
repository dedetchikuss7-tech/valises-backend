import { ApiProperty } from '@nestjs/swagger';
import { PayoutResponseDto } from './payout-response.dto';
import { PayoutTransactionSummaryDto } from './payout-transaction-summary.dto';

export class PayoutWithTransactionResponseDto extends PayoutResponseDto {
  @ApiProperty({
    description: 'Linked transaction summary',
    type: PayoutTransactionSummaryDto,
  })
  transaction!: PayoutTransactionSummaryDto;
}