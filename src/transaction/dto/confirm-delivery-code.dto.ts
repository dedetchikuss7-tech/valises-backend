import { Matches } from 'class-validator';

export class ConfirmDeliveryCodeDto {
  @Matches(/^\d{6}$/, {
    message: 'code must be a 6-digit numeric string',
  })
  code!: string;
}