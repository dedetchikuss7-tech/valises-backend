import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdminCaseTransitionDto {
  @ApiPropertyOptional({
    description: 'Optional admin note attached to the transition',
  })
  @IsOptional()
  @IsString()
  note?: string;
}