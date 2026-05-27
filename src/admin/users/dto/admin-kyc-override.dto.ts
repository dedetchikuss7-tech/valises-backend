import { IsString, IsEnum, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AdminKycOverrideStatus {
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export class AdminKycOverrideDto {
  @ApiProperty({ enum: AdminKycOverrideStatus })
  @IsEnum(AdminKycOverrideStatus)
  status: AdminKycOverrideStatus;

  @ApiProperty({ description: 'Mandatory reason for the override (min 10 chars)' })
  @IsString()
  @MinLength(10)
  reason: string;
}
