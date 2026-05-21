import { ApiProperty } from '@nestjs/swagger';
import { AdminProviderOperationalSummaryDto } from './admin-provider-operational-summary.dto';

export class AdminFinancialOperationsSummaryResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  highPriorityCount!: number;

  @ApiProperty()
  mediumPriorityCount!: number;

  @ApiProperty()
  lowPriorityCount!: number;

  @ApiProperty()
  requiresActionCount!: number;

  @ApiProperty()
  payoutItems!: number;

  @ApiProperty()
  refundItems!: number;

  @ApiProperty()
  financialControlItems!: number;

  @ApiProperty()
  failedOperationsCount!: number;

  @ApiProperty()
  staleOperationsCount!: number;

  @ApiProperty()
  escalatedOperationsCount!: number;

  @ApiProperty()
  criticalOperationsCount!: number;

  @ApiProperty()
  slaBreachesCount!: number;

  @ApiProperty()
  stuckOperationsCount!: number;

  @ApiProperty({
    type: AdminProviderOperationalSummaryDto,
  })
  providerOperationalSummary!: AdminProviderOperationalSummaryDto;
}