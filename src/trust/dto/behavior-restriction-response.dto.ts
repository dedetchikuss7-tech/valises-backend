import { ApiProperty } from '@nestjs/swagger';
import {
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
} from '@prisma/client';

export class BehaviorRestrictionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: BehaviorRestrictionKind })
  kind!: BehaviorRestrictionKind;

  @ApiProperty({ enum: BehaviorRestrictionScope })
  scope!: BehaviorRestrictionScope;

  @ApiProperty({ enum: BehaviorRestrictionStatus })
  status!: BehaviorRestrictionStatus;

  @ApiProperty()
  reasonCode!: string;

  @ApiProperty({ nullable: true })
  reasonSummary!: string | null;

  @ApiProperty({ nullable: true })
  imposedById!: string | null;

  @ApiProperty({ nullable: true })
  releasedById!: string | null;

  @ApiProperty()
  imposedAt!: Date;

  @ApiProperty({ nullable: true })
  releasedAt!: Date | null;

  @ApiProperty({ nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}