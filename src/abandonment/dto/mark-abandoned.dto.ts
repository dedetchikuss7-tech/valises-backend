import { AbandonmentKind } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';

export class MarkAbandonedDto {
  @IsEnum(AbandonmentKind)
  kind!: AbandonmentKind;

  @IsOptional()
  @IsUUID()
  tripId?: string;

  @IsOptional()
  @IsUUID()
  packageId?: string;

  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}