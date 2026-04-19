import { ApiProperty } from '@nestjs/swagger';
import { AdminOpsCaseType } from './list-admin-ops-cases-query.dto';

export class AdminOpsCaseResponseDto {
  @ApiProperty({ enum: AdminOpsCaseType })
  caseType!: AdminOpsCaseType;

  @ApiProperty()
  caseId!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  priority!: string;

  @ApiProperty()
  requiresAction!: boolean;

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
}