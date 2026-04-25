import { ApiProperty } from '@nestjs/swagger';

export class AdminWorkloadAssigneeResponseDto {
  @ApiProperty({ nullable: true })
  assignedAdminId!: string | null;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  openRows!: number;

  @ApiProperty()
  overdueRows!: number;

  @ApiProperty()
  dueSoonRows!: number;

  @ApiProperty()
  inReviewRows!: number;

  @ApiProperty()
  waitingExternalRows!: number;
}

export class AdminWorkloadAssigneeListResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty({ type: [AdminWorkloadAssigneeResponseDto] })
  items!: AdminWorkloadAssigneeResponseDto[];
}