import { ApiProperty } from '@nestjs/swagger';
import {
  LedgerEntryType,
  LedgerReferenceType,
  LedgerSource,
} from '@prisma/client';

export class TransactionLedgerEntryDto {
  @ApiProperty({
    description: 'Ledger entry ID',
    example: '0d7c9e12-6b70-4d4f-86c8-8df1d5a1d001',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction ID linked to this ledger entry',
    example: '7c79fd4d-2d7c-4b26-b98d-3cf7d08d0001',
  })
  transactionId!: string;

  @ApiProperty({
    description: 'Ledger entry type',
    enum: LedgerEntryType,
    example: LedgerEntryType.ESCROW_CREDIT,
  })
  type!: LedgerEntryType;

  @ApiProperty({
    description: 'Ledger entry amount',
    example: 10000,
  })
  amount!: number;

  @ApiProperty({
    description: 'Business source of the ledger entry',
    enum: LedgerSource,
    example: LedgerSource.PAYMENT,
  })
  source!: LedgerSource;

  @ApiProperty({
    description: 'Reference entity type associated with the ledger entry',
    enum: LedgerReferenceType,
    example: LedgerReferenceType.TRANSACTION,
  })
  referenceType!: LedgerReferenceType;

  @ApiProperty({
    description: 'Reference entity ID associated with the ledger entry',
    example: '7c79fd4d-2d7c-4b26-b98d-3cf7d08d0001',
    nullable: true,
  })
  referenceId!: string | null;

  @ApiProperty({
    description: 'Actor user ID that triggered the ledger entry when available',
    example: '11d365f2-3d0f-4db9-a0f0-7c3b26d50001',
    nullable: true,
  })
  actorUserId!: string | null;

  @ApiProperty({
    description: 'Idempotency key used to protect ledger creation when applicable',
    example: 'payment_success:7c79fd4d-2d7c-4b26-b98d-3cf7d08d0001',
    nullable: true,
  })
  idempotencyKey!: string | null;

  @ApiProperty({
    description: 'Ledger entry creation timestamp',
    example: '2026-03-31T10:15:30.000Z',
  })
  createdAt!: Date;
}