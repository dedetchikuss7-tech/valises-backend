// src/transaction/dto/update-transaction-status.dto.ts
import { IsEnum } from 'class-validator';
import { TransactionStatus } from '@prisma/client';

export class UpdateTransactionStatusDto {
  @IsEnum(TransactionStatus)
  status!: TransactionStatus;
}