import { ApiProperty } from '@nestjs/swagger';

export class AdminWorkloadBreakdownItemDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  count!: number;
}

export class AdminWorkloadTopAssigneeDto {
  @ApiProperty({ nullable: true })
  assignedAdminId!: string | null;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  openRows!: number;

  @ApiProperty()
  criticalRows!: number;

  @ApiProperty()
  highUrgencyRows!: number;

  @ApiProperty()
  overdueRows!: number;

  @ApiProperty()
  needsReviewAttentionRows!: number;
}

export class AdminWorkloadOverviewResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  openRows!: number;

  @ApiProperty()
  terminalRows!: number;

  @ApiProperty()
  criticalRows!: number;

  @ApiProperty()
  highUrgencyRows!: number;

  @ApiProperty()
  mediumUrgencyRows!: number;

  @ApiProperty()
  lowUrgencyRows!: number;

  @ApiProperty()
  overdueRows!: number;

  @ApiProperty()
  dueSoonRows!: number;

  @ApiProperty()
  unassignedRows!: number;

  @ApiProperty()
  myOpenRows!: number;

  @ApiProperty()
  needsReviewAttentionRows!: number;

  @ApiProperty()
  hasRecentAdminActionRows!: number;

  @ApiProperty()
  waitingExternalRows!: number;

  @ApiProperty()
  inReviewRows!: number;

  @ApiProperty()
  doneRows!: number;

  @ApiProperty()
  releasedRows!: number;

  @ApiProperty({ type: [AdminWorkloadBreakdownItemDto] })
  byObjectType!: AdminWorkloadBreakdownItemDto[];

  @ApiProperty({ type: [AdminWorkloadBreakdownItemDto] })
  byOperationalStatus!: AdminWorkloadBreakdownItemDto[];

  @ApiProperty({ type: [AdminWorkloadBreakdownItemDto] })
  byUrgencyLevel!: AdminWorkloadBreakdownItemDto[];

  @ApiProperty({ type: [AdminWorkloadBreakdownItemDto] })
  bySlaStatus!: AdminWorkloadBreakdownItemDto[];

  @ApiProperty({ type: [AdminWorkloadBreakdownItemDto] })
  byRecommendedAction!: AdminWorkloadBreakdownItemDto[];

  @ApiProperty({ type: [AdminWorkloadTopAssigneeDto] })
  topAssignees!: AdminWorkloadTopAssigneeDto[];
}