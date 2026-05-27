import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUserListQueryDto {
  @ApiPropertyOptional({ description: 'Cursor for pagination (userId)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by partial email match' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'VERIFIED', 'REJECTED'] })
  @IsOptional()
  @IsString()
  kycStatus?: string;

  @ApiPropertyOptional({ enum: ['EXPLORER', 'VERIFIED', 'TRUSTED', 'HIGH_TRUST'] })
  @IsOptional()
  @IsString()
  trustLevel?: string;

  @ApiPropertyOptional({ description: 'true = only suspended users' })
  @IsOptional()
  @IsString()
  suspended?: string;

  @ApiPropertyOptional({ description: 'true = only banned users' })
  @IsOptional()
  @IsString()
  banned?: string;
}
