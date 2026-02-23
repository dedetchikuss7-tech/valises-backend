// src/transaction/dto/create-transaction.dto.ts
import { IsNumber, IsString, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  senderId!: string;

  @IsString()
  travelerId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;
}