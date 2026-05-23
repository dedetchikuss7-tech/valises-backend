import { ApiProperty } from '@nestjs/swagger';

export class OnboardingStepDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  completed: boolean;

  @ApiProperty()
  required: boolean;

  @ApiProperty()
  nextStepUrl: string;
}

export class OnboardingStatusResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  kycStatus: string;

  @ApiProperty({ type: [OnboardingStepDto] })
  steps: OnboardingStepDto[];

  @ApiProperty()
  isReadyToTransact: boolean;

  @ApiProperty({ type: [String] })
  readinessBlockers: string[];
}
