import { ApiProperty } from '@nestjs/swagger';
import {
  CurrencyCode,
  PackageContentCategory,
  PackageContentComplianceStatus,
  PackageStatus,
} from '@prisma/client';

export class PackageResponseDto {
  @ApiProperty({
    description: 'Package ID',
    example: 'f538a358-1828-4ff6-aed6-90425d688596',
  })
  id!: string;

  @ApiProperty({
    description: 'Sender user ID',
    example: 'e243bcc1-38bf-4722-86ac-aa7119eee4a7',
  })
  senderId!: string;

  @ApiProperty({
    description: 'Corridor ID',
    example: '30fa8e47-ac12-4745-9058-4eb8bf490cac',
  })
  corridorId!: string;

  @ApiProperty({
    description: 'Package weight in kg when provided',
    example: 12,
    nullable: true,
  })
  weightKg!: number | null;

  @ApiProperty({
    description: 'Package description when provided',
    example: 'Documents and clothes',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    description: 'Package lifecycle status',
    enum: PackageStatus,
    example: PackageStatus.DRAFT,
  })
  status!: PackageStatus;

  @ApiProperty({
    description: 'Optional handover declaration timestamp',
    example: '2026-04-16T22:40:00.000Z',
    nullable: true,
  })
  handoverDeclaredAt!: Date | null;

  @ApiProperty({
    description: 'User ID who declared handover when available',
    example: 'e243bcc1-38bf-4722-86ac-aa7119eee4a7',
    nullable: true,
  })
  handoverDeclaredById!: string | null;

  @ApiProperty({
    description: 'Optional handover notes',
    example: 'Package handed over at agreed meeting point',
    nullable: true,
  })
  handoverNotes!: string | null;

  @ApiProperty({
    description: 'Traveler responsibility acknowledgement timestamp',
    example: '2026-04-16T22:50:00.000Z',
    nullable: true,
  })
  travelerResponsibilityAcknowledgedAt!: Date | null;

  @ApiProperty({
    description: 'User ID who acknowledged traveler responsibility',
    example: '0d60bc14-6d4c-4de9-ae5e-d85d5d3c0f2d',
    nullable: true,
  })
  travelerResponsibilityAcknowledgedById!: string | null;

  @ApiProperty({
    description: 'Declared content category',
    enum: PackageContentCategory,
    example: PackageContentCategory.CLOTHING,
    nullable: true,
  })
  contentCategory!: PackageContentCategory | null;

  @ApiProperty({
    description: 'Declared content summary',
    example: 'Clothes, shoes and personal care items',
    nullable: true,
  })
  contentSummary!: string | null;

  @ApiProperty({
    description: 'Approximate declared item count',
    example: 6,
    nullable: true,
  })
  declaredItemCount!: number | null;

  @ApiProperty({
    description: 'Approximate declared package value',
    example: 150,
    nullable: true,
  })
  declaredValueAmount!: number | null;

  @ApiProperty({
    description: 'Currency of the declared package value',
    enum: CurrencyCode,
    example: CurrencyCode.EUR,
    nullable: true,
  })
  declaredValueCurrency!: CurrencyCode | null;

  @ApiProperty({
    description: 'Sender declared fragile items',
    example: false,
  })
  containsFragileItems!: boolean;

  @ApiProperty({
    description: 'Sender declared liquid contents',
    example: false,
  })
  containsLiquid!: boolean;

  @ApiProperty({
    description: 'Sender declared electronics',
    example: false,
  })
  containsElectronic!: boolean;

  @ApiProperty({
    description: 'Sender declared batteries',
    example: false,
  })
  containsBattery!: boolean;

  @ApiProperty({
    description: 'Sender declared medicines',
    example: false,
  })
  containsMedicine!: boolean;

  @ApiProperty({
    description: 'Sender declared perishable items',
    example: false,
  })
  containsPerishableItems!: boolean;

  @ApiProperty({
    description: 'Sender declared valuable items',
    example: false,
  })
  containsValuableItems!: boolean;

  @ApiProperty({
    description: 'Sender declared documents',
    example: false,
  })
  containsDocuments!: boolean;

  @ApiProperty({
    description: 'Sender declared prohibited items',
    example: false,
  })
  containsProhibitedItems!: boolean;

  @ApiProperty({
    description: 'Prohibited-items declaration acceptance timestamp',
    example: '2026-04-17T09:10:00.000Z',
    nullable: true,
  })
  prohibitedItemsDeclarationAcceptedAt!: Date | null;

  @ApiProperty({
    description: 'User ID who accepted the prohibited-items declaration',
    example: 'e243bcc1-38bf-4722-86ac-aa7119eee4a7',
    nullable: true,
  })
  prohibitedItemsDeclarationAcceptedById!: string | null;

  @ApiProperty({
    description: 'Content declaration timestamp',
    example: '2026-04-17T09:12:00.000Z',
    nullable: true,
  })
  contentDeclaredAt!: Date | null;

  @ApiProperty({
    description: 'User ID who declared the package content',
    example: 'e243bcc1-38bf-4722-86ac-aa7119eee4a7',
    nullable: true,
  })
  contentDeclaredById!: string | null;

  @ApiProperty({
    description: 'Compliance status derived from the content declaration',
    enum: PackageContentComplianceStatus,
    example: PackageContentComplianceStatus.DECLARED_CLEAR,
  })
  contentComplianceStatus!: PackageContentComplianceStatus;

  @ApiProperty({
    description: 'Operational compliance notes derived from the declaration',
    example: 'Sensitive content declared: manual review may be required later.',
    nullable: true,
  })
  contentComplianceNotes!: string | null;

  @ApiProperty({
    description: 'Package creation timestamp',
    example: '2026-04-01T09:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Package last update timestamp',
    example: '2026-04-01T09:10:00.000Z',
  })
  updatedAt!: Date;
}