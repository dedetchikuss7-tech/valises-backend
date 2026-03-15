import { Type } from 'class-transformer';
import { AbandonmentEventStatus, AbandonmentKind } from '@prisma/client';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAbandonmentEventsQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  kind?: AbandonmentKind | string;

  @IsOptional()
  @IsString()
  status?: AbandonmentEventStatus | string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}