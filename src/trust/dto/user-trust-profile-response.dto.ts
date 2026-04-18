import { ApiProperty } from '@nestjs/swagger';
import { TrustProfileStatus } from '@prisma/client';

export class UserTrustProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty({ enum: TrustProfileStatus })
  status!: TrustProfileStatus;

  @ApiProperty()
  totalEvents!: number;

  @ApiProperty()
  positiveEvents!: number;

  @ApiProperty()
  negativeEvents!: number;

  @ApiProperty()
  activeRestrictionCount!: number;

  @ApiProperty({ nullable: true })
  lastEventAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}