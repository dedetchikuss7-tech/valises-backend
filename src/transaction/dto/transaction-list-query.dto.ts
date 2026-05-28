import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by transaction status' })
  @IsOptional()
  @IsString()
  status?: string;
}
