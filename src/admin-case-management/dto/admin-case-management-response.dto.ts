import { ApiProperty } from '@nestjs/swagger';
import {
  AdminCaseDerivedStatus,
  AdminCaseSourceType,
} from './list-admin-case-management-query.dto';

class AdminCaseNoteResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  authorAdminId!: string;

  @ApiProperty()
  note!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class AdminCaseManagementResponseDto {
  @ApiProperty({ enum: AdminCaseSourceType })
  sourceType!: AdminCaseSourceType;

  @ApiProperty()
  sourceId!: string;

  @ApiProperty({ enum: AdminCaseDerivedStatus })
  status!: AdminCaseDerivedStatus;

  @ApiProperty()
  requiresAction!: boolean;

  @ApiProperty({ nullable: true })
  assignedAdminId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  updatedAt!: Date | null;

  @ApiProperty({ nullable: true })
  transactionId!: string | null;

  @ApiProperty({ nullable: true })
  subjectUserId!: string | null;

  @ApiProperty({ nullable: true })
  secondaryUserId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  subtitle!: string | null;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty({
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: [AdminCaseNoteResponseDto] })
  notes!: AdminCaseNoteResponseDto[];
}