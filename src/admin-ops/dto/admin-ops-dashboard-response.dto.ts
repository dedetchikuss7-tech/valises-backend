import { ApiProperty } from '@nestjs/swagger';

export class AdminOpsDashboardResponseDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  openAmlCases!: number;

  @ApiProperty()
  openDisputes!: number;

  @ApiProperty()
  activeRestrictions!: number;

  @ApiProperty()
  pendingPayouts!: number;

  @ApiProperty()
  pendingRefunds!: number;

  @ApiProperty()
  activeAbandonmentEvents!: number;

  @ApiProperty()
  pendingReminderJobs!: number;

  @ApiProperty()
  visibleShortlistEntries!: number;

  @ApiProperty()
  requiresActionCount!: number;
}