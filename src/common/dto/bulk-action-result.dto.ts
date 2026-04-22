import { ApiProperty } from '@nestjs/swagger';

export class BulkActionItemResultDto {
  @ApiProperty()
  itemId!: string;

  @ApiProperty()
  success!: boolean;

  @ApiProperty({ nullable: true })
  message!: string | null;
}

export class BulkActionResultDto {
  @ApiProperty()
  requestedCount!: number;

  @ApiProperty()
  successCount!: number;

  @ApiProperty()
  failureCount!: number;

  @ApiProperty({ type: [BulkActionItemResultDto] })
  results!: BulkActionItemResultDto[];
}