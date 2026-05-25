import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional } from 'class-validator';

export class TriggerPspReconciliationRunDto {
  @ApiProperty({ description: 'Start of date range (inclusive)', example: '2026-05-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  dateFrom: Date;

  @ApiProperty({ description: 'End of date range (inclusive)', example: '2026-05-24T23:59:59.999Z' })
  @Type(() => Date)
  @IsDate()
  dateTo: Date;

  @ApiPropertyOptional({ description: 'Dry-run mode: check PSP but do not persist cases', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean = false;
}
