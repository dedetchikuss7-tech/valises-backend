import { ApiProperty } from '@nestjs/swagger';
import {
  AdminReconciliationCaseType,
  AdminReconciliationDerivedStatus,
} from './list-admin-reconciliation-cases-query.dto';

export class AdminReconciliationCaseResponseDto {
  @ApiProperty({ enum: AdminReconciliationCaseType })
  caseType!: AdminReconciliationCaseType;

  @ApiProperty()
  caseId!: string;

  @ApiProperty({ enum: AdminReconciliationDerivedStatus })
  derivedStatus!: AdminReconciliationDerivedStatus;

  @ApiProperty()
  requiresAction!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  updatedAt!: Date | null;

  @ApiProperty({ nullable: true })
  transactionId!: string | null;

  @ApiProperty({ nullable: true })
  senderId!: string | null;

  @ApiProperty({ nullable: true })
  travelerId!: string | null;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  rawStatus!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ type: [String] })
  mismatchSignals!: string[];

  @ApiProperty({
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;
}