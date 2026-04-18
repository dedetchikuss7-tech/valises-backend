import { ApiProperty } from '@nestjs/swagger';
import { AmlDecisionAction, AmlRiskLevel } from '@prisma/client';
import { AmlCaseResponseDto } from './aml-case-response.dto';

export class EvaluateTransactionAmlResponseDto {
  @ApiProperty()
  transactionId!: string;

  @ApiProperty()
  allowed!: boolean;

  @ApiProperty({ enum: AmlRiskLevel })
  riskLevel!: AmlRiskLevel;

  @ApiProperty({ enum: AmlDecisionAction })
  recommendedAction!: AmlDecisionAction;

  @ApiProperty({ type: [String] })
  signalCodes!: string[];

  @ApiProperty()
  signalCount!: number;

  @ApiProperty({ nullable: true })
  reasonSummary!: string | null;

  @ApiProperty()
  caseCreated!: boolean;

  @ApiProperty({
    type: AmlCaseResponseDto,
    nullable: true,
  })
  amlCase!: AmlCaseResponseDto | null;
}