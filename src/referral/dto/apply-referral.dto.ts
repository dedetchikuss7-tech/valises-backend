import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ApplyReferralDto {
  @ApiProperty({ example: 'AB12CD34', description: '8-character referral code' })
  @IsString()
  @Length(1, 32)
  code: string;
}
