import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CurrencyCode,
  PackageContentCategory,
  PackageContentComplianceStatus,
  PackageStatus,
} from '@prisma/client';
import {
  PackageHandoverStatus,
  PackageOperationalReadinessReason,
  PackageOperationalReadinessStatus,
  PackageTravelerResponsibilityStatus,
} from './package-operational-status.dto';

export class PackageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty()
  corridorId!: string;

  @ApiPropertyOptional({ nullable: true })
  weightKg!: number | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: PackageStatus })
  status!: PackageStatus;

  @ApiPropertyOptional({
    enum: PackageContentCategory,
    nullable: true,
  })
  contentCategory!: PackageContentCategory | null;

  @ApiPropertyOptional({ nullable: true })
  contentSummary!: string | null;

  @ApiPropertyOptional({ nullable: true })
  declaredItemCount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  declaredValueAmount!: number | null;

  @ApiPropertyOptional({
    enum: CurrencyCode,
    nullable: true,
  })
  declaredValueCurrency!: CurrencyCode | null;

  @ApiProperty()
  containsFragileItems!: boolean;

  @ApiProperty()
  containsLiquid!: boolean;

  @ApiProperty()
  containsElectronic!: boolean;

  @ApiProperty()
  containsBattery!: boolean;

  @ApiProperty()
  containsMedicine!: boolean;

  @ApiProperty()
  containsPerishableItems!: boolean;

  @ApiProperty()
  containsValuableItems!: boolean;

  @ApiProperty()
  containsDocuments!: boolean;

  @ApiProperty()
  containsProhibitedItems!: boolean;

  @ApiPropertyOptional({ nullable: true })
  prohibitedItemsDeclarationAcceptedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  prohibitedItemsDeclarationAcceptedById!: string | null;

  @ApiPropertyOptional({ nullable: true })
  contentDeclaredAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  contentDeclaredById!: string | null;

  @ApiProperty({ enum: PackageContentComplianceStatus })
  contentComplianceStatus!: PackageContentComplianceStatus;

  @ApiPropertyOptional({ nullable: true })
  contentComplianceNotes!: string | null;

  @ApiPropertyOptional({ nullable: true })
  handoverDeclaredAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  handoverDeclaredById!: string | null;

  @ApiPropertyOptional({ nullable: true })
  handoverNotes!: string | null;

  @ApiPropertyOptional({ nullable: true })
  travelerResponsibilityAcknowledgedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  travelerResponsibilityAcknowledgedById!: string | null;

  @ApiProperty({ enum: PackageHandoverStatus })
  handoverStatus!: PackageHandoverStatus;

  @ApiProperty({ enum: PackageTravelerResponsibilityStatus })
  travelerResponsibilityStatus!: PackageTravelerResponsibilityStatus;

  @ApiProperty({ enum: PackageOperationalReadinessStatus })
  packageOperationalReadiness!: PackageOperationalReadinessStatus;

  @ApiProperty({
    enum: PackageOperationalReadinessReason,
    isArray: true,
  })
  packageOperationalReadinessReasons!: PackageOperationalReadinessReason[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}