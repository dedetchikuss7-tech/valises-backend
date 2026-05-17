import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, TransactionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  TransactionOperationalPlaybookCode,
  TransactionOperationalReadinessStatus,
} from './admin-transaction-operational-playbook.dto';

export class ListAdminTransactionOperationalPlaybooksQueryDto {
  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  transactionStatus?: TransactionStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: TransactionOperationalReadinessStatus })
  @IsOptional()
  @IsEnum(TransactionOperationalReadinessStatus)
  readinessStatus?: TransactionOperationalReadinessStatus;

  @ApiPropertyOptional({ enum: TransactionOperationalPlaybookCode })
  @IsOptional()
  @IsEnum(TransactionOperationalPlaybookCode)
  playbookCode?: TransactionOperationalPlaybookCode;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasAdminBlockers?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasAutomationCandidates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}