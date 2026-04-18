import { ApiProperty } from '@nestjs/swagger';
import { BehaviorRestrictionResponseDto } from './behavior-restriction-response.dto';
import { UserTrustProfileResponseDto } from './user-trust-profile-response.dto';

export class ImposeBehaviorRestrictionResponseDto {
  @ApiProperty({ type: BehaviorRestrictionResponseDto })
  restriction!: BehaviorRestrictionResponseDto;

  @ApiProperty({ type: UserTrustProfileResponseDto })
  profile!: UserTrustProfileResponseDto;
}