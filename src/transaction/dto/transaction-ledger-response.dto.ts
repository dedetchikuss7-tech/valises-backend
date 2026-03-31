import { ApiProperty } from '@nestjs/swagger';
import { TransactionLedgerEntryDto } from './transaction-ledger-entry.dto';

export class TransactionLedgerResponseDto {
  @ApiProperty({
    description: 'Transaction ID for which ledger data is returned',
    example: '7c79fd4d-2d7c-4b26-b98d-3cf7d08d0001',
  })
  transactionId!: string;

  @ApiProperty({
    description: 'Current escrow balance computed from linked ledger entries',
    example: 0,
  })
  escrowBalance!: number;

  @ApiProperty({
    description: 'Ledger entries linked to the transaction',
    type: TransactionLedgerEntryDto,
    isArray: true,
  })
  entries!: TransactionLedgerEntryDto[];
}