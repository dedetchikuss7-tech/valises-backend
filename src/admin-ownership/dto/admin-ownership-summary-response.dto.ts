import { ApiProperty } from '@nestjs/swagger';

export class AdminOwnershipSummaryResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  unassignedRows!: number;

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

  @ApiProperty()
  overdueRows!: number;

  @ApiProperty()
  dueSoonRows!: number;
}