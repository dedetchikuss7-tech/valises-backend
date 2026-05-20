import { ApiProperty } from '@nestjs/swagger';

export class PayoutOperationalWorkflowStepDto {
  @ApiProperty({
    example: 'VALIDATE_TRANSACTION',
  })
  code!: string;

  @ApiProperty({
    example: 'Validate transaction operational state',
  })
  label!: string;

  @ApiProperty({
    example: true,
  })
  completed!: boolean;

  @ApiProperty({
    example: false,
  })
  blocking!: boolean;
}

export class PayoutOperationalWorkflowDto {
  @ApiProperty({
    type: [PayoutOperationalWorkflowStepDto],
  })
  steps!: PayoutOperationalWorkflowStepDto[];

  @ApiProperty({
    example: 4,
  })
  completedSteps!: number;

  @ApiProperty({
    example: 5,
  })
  totalSteps!: number;

  @ApiProperty({
    example: false,
  })
  blocked!: boolean;
}