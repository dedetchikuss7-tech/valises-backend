import { IsUUID } from 'class-validator';

export class CreateTransactionDto {
  @IsUUID()
  tripId: string;

  @IsUUID()
  packageId: string;
}