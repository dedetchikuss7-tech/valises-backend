import { IsString, MinLength } from 'class-validator';

export class EscalateDisputeDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
