import { ApiProperty } from '@nestjs/swagger';
import { ReputationEventResponseDto } from './reputation-event-response.dto';
import { UserTrustProfileResponseDto } from './user-trust-profile-response.dto';

export class RecordReputationEventResponseDto {
  @ApiProperty({ type: ReputationEventResponseDto })
  event!: ReputationEventResponseDto;

  @ApiProperty({ type: UserTrustProfileResponseDto })
  profile!: UserTrustProfileResponseDto;
}