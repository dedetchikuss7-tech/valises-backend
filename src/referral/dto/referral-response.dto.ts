import { ApiProperty } from '@nestjs/swagger';

export class ReferralCodeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() ownerId: string;
  @ApiProperty() code: string;
  @ApiProperty() createdAt: Date;
}

export class ReferralUseResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() referralCodeId: string;
  @ApiProperty() referredUserId: string;
  @ApiProperty() rewardGranted: boolean;
  @ApiProperty() createdAt: Date;
}
