import { ApiProperty } from '@nestjs/swagger';

export class AdminWorkloadSingleActionResultDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  objectType!: string;

  @ApiProperty()
  objectId!: string;

  @ApiProperty({ nullable: true })
  error!: string | null;
}

export class AdminWorkloadBulkActionResultDto {
  @ApiProperty()
  requestedCount!: number;

  @ApiProperty()
  successCount!: number;

  @ApiProperty()
  failureCount!: number;

  @ApiProperty({ type: [AdminWorkloadSingleActionResultDto] })
  results!: AdminWorkloadSingleActionResultDto[];
}