import { IsString, MaxLength, MinLength } from 'class-validator';

export class MarkRefundFailedDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}