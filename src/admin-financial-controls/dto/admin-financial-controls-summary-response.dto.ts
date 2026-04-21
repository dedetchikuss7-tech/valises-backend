import { ApiProperty } from '@nestjs/swagger';

export class AdminFinancialControlsSummaryResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  cleanRows!: number;

  @ApiProperty()
  warningRows!: number;

  @ApiProperty()
  breachRows!: number;

  @ApiProperty()
  requiresActionCount!: number;
}