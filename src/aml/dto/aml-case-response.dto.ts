import { ApiProperty } from '@nestjs/swagger';
import {
  AmlCaseStatus,
  AmlDecisionAction,
  AmlRiskLevel,
} from '@prisma/client';

export class AmlCaseResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  transactionId!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty()
  travelerId!: string;

  @ApiProperty({ nullable: true })
  packageId!: string | null;

  @ApiProperty({ enum: AmlRiskLevel })
  riskLevel!: AmlRiskLevel;

  @ApiProperty({ enum: AmlDecisionAction })
  recommendedAction!: AmlDecisionAction;

  @ApiProperty({ enum: AmlDecisionAction })
  currentAction!: AmlDecisionAction;

  @ApiProperty({ enum: AmlCaseStatus })
  status!: AmlCaseStatus;

  @ApiProperty({ type: [String] })
  signalCodes!: string[];

  @ApiProperty()
  signalCount!: number;

  @ApiProperty({ nullable: true })
  reasonSummary!: string | null;

  @ApiProperty({ nullable: true })
  reviewedById!: string | null;

  @ApiProperty({ nullable: true })
  reviewNotes!: string | null;

  @ApiProperty()
  openedAt!: Date;

  @ApiProperty({ nullable: true })
  resolvedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}