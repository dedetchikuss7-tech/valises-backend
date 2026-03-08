import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { KycStatus } from '@prisma/client';

export class UpdateKycStatusDto {
  @ApiProperty({
    enum: KycStatus,
    example: KycStatus.VERIFIED,
    description: 'New KYC status for the user',
  })
  @IsEnum(KycStatus)
  kycStatus: KycStatus;
}