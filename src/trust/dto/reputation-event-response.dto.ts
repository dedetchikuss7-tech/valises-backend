import { ApiProperty } from '@nestjs/swagger';
import { ReputationEventKind } from '@prisma/client';

export class ReputationEventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ nullable: true })
  transactionId!: string | null;

  @ApiProperty({ enum: ReputationEventKind })
  kind!: ReputationEventKind;

  @ApiProperty()
  scoreDelta!: number;

  @ApiProperty()
  reasonCode!: string;

  @ApiProperty({ nullable: true })
  reasonSummary!: string | null;

  @ApiProperty()
  createdAt!: Date;
}