import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ListAdminTransactionOperationalTimelineQueryDto {
  @ApiPropertyOptional({
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeAdminActions?: boolean = true;

  @ApiPropertyOptional({
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeEvidence?: boolean = true;

  @ApiPropertyOptional({
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeOperationalCases?: boolean = true;
}