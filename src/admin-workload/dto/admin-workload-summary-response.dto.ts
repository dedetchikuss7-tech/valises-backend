import { ApiProperty } from '@nestjs/swagger';

export class AdminWorkloadSummaryResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  openRows!: number;

  @ApiProperty()
  unassignedRows!: number;

  @ApiProperty()
  myOpenRows!: number;

  @ApiProperty()
  overdueRows!: number;

  @ApiProperty()
  dueSoonRows!: number;

  @ApiProperty()
  claimedRows!: number;

  @ApiProperty()
  inReviewRows!: number;

  @ApiProperty()
  waitingExternalRows!: number;

  @ApiProperty()
  doneRows!: number;

  @ApiProperty()
  releasedRows!: number;
}