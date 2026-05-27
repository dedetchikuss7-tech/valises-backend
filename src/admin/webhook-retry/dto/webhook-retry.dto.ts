import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FailedWebhooksQueryDto {
  @ApiPropertyOptional({ description: 'Cursor for pagination (ProviderEvent id)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by provider name' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class WebhookStatsQueryDto {
  @ApiPropertyOptional({ description: 'Number of days to look back (default 7, max 30)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  days?: number = 7;
}
