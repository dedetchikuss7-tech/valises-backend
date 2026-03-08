import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsUUID()
  tripId: string;

  @IsUUID()
  packageId: string;

  @IsInt()
  @Min(1)
  amount: number;
}