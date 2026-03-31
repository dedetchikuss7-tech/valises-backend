import { ApiProperty } from '@nestjs/swagger';
import {
  KycStatus,
  PackageStatus,
  PaymentStatus,
  Role,
  TransactionStatus,
  TripStatus,
} from '@prisma/client';
import { TransactionPricingDetailsDto } from './transaction-pricing-details.dto';

class TransactionUserSummaryDto {
  @ApiProperty({
    description: 'User ID',
    example: 'e243bcc1-38f3-4722-86ac-aa7119eee4a7',
  })
  id!: string;

  @ApiProperty({
    description: 'User email',
    example: 'sender@test.com',
  })
  email!: string;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.USER,
  })
  role!: Role;

  @ApiProperty({
    description: 'User KYC status',
    enum: KycStatus,
    example: KycStatus.VERIFIED,
  })
  kycStatus!: KycStatus;
}

class TransactionTripSummaryDto {
  @ApiProperty({
    description: 'Trip ID',
    example: '59dabd86-3632-4168-8b6f-17592ff35f61',
  })
  id!: string;

  @ApiProperty({
    description: 'Trip status',
    enum: TripStatus,
    example: TripStatus.ACTIVE,
  })
  status!: TripStatus;

  @ApiProperty({
    description: 'Flight ticket verification status',
    example: 'VERIFIED',
  })
  flightTicketStatus!: string;

  @ApiProperty({
    description: 'Trip departure datetime',
    example: '2026-04-10T10:00:00.000Z',
  })
  departAt!: string;

  @ApiProperty({
    description: 'Corridor ID linked to the trip',
    example: 'corridor-1',
  })
  corridorId!: string;

  @ApiProperty({
    description: 'Carrier / traveler user ID',
    example: 'traveler-1',
  })
  carrierId!: string;
}

class TransactionPackageSummaryDto {
  @ApiProperty({
    description: 'Package ID',
    example: 'f538a358-1828-4ff6-aed6-90425d688596',
  })
  id!: string;

  @ApiProperty({
    description: 'Package status',
    enum: PackageStatus,
    example: PackageStatus.RESERVED,
  })
  status!: PackageStatus;

  @ApiProperty({
    description: 'Package weight in kilograms',
    example: 23,
  })
  weightKg!: number;

  @ApiProperty({
    description: 'Package description',
    example: 'Package 23kg',
  })
  description!: string;

  @ApiProperty({
    description: 'Corridor ID linked to the package',
    example: 'corridor-1',
  })
  corridorId!: string;

  @ApiProperty({
    description: 'Sender user ID linked to the package',
    example: 'sender-1',
  })
  senderId!: string;
}

class TransactionCorridorSummaryDto {
  @ApiProperty({
    description: 'Corridor ID',
    example: 'corridor-1',
  })
  id!: string;

  @ApiProperty({
    description: 'Corridor code',
    example: 'FR_CM',
  })
  code!: string;

  @ApiProperty({
    description: 'Corridor display name',
    example: 'FR_CM',
  })
  name!: string;

  @ApiProperty({
    description: 'Corridor status',
    example: 'ACTIVE',
  })
  status!: string;
}

export class TransactionReadResponseDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'a1b53644-ca2d-4d26-abe4-24e381049cb9',
  })
  id!: string;

  @ApiProperty({
    description: 'Sender user ID',
    example: 'sender-1',
  })
  senderId!: string;

  @ApiProperty({
    description: 'Traveler user ID',
    example: 'traveler-1',
  })
  travelerId!: string;

  @ApiProperty({
    description: 'Trip ID',
    example: 'trip-1',
  })
  tripId!: string;

  @ApiProperty({
    description: 'Package ID',
    example: 'package-1',
  })
  packageId!: string;

  @ApiProperty({
    description: 'Corridor ID',
    example: 'corridor-1',
  })
  corridorId!: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 185,
  })
  amount!: number;

  @ApiProperty({
    description: 'Platform commission amount',
    example: 0,
  })
  commission!: number;

  @ApiProperty({
    description: 'Escrow amount currently held',
    example: 0,
  })
  escrowAmount!: number;

  @ApiProperty({
    description: 'Transaction currency',
    example: 'EUR',
  })
  currency!: string;

  @ApiProperty({
    description: 'Transaction business status',
    enum: TransactionStatus,
    example: TransactionStatus.CREATED,
  })
  status!: TransactionStatus;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  paymentStatus!: PaymentStatus;

  @ApiProperty({
    description: 'Transaction creation datetime',
    example: '2026-03-22T14:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Transaction last update datetime',
    example: '2026-03-22T14:30:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Sender summary',
    type: TransactionUserSummaryDto,
  })
  sender!: TransactionUserSummaryDto;

  @ApiProperty({
    description: 'Traveler summary',
    type: TransactionUserSummaryDto,
  })
  traveler!: TransactionUserSummaryDto;

  @ApiProperty({
    description: 'Trip summary',
    type: TransactionTripSummaryDto,
  })
  trip!: TransactionTripSummaryDto;

  @ApiProperty({
    description: 'Package summary',
    type: TransactionPackageSummaryDto,
  })
  package!: TransactionPackageSummaryDto;

  @ApiProperty({
    description: 'Corridor summary',
    type: TransactionCorridorSummaryDto,
    nullable: true,
  })
  corridor!: TransactionCorridorSummaryDto | null;

  @ApiProperty({
    description: 'Linked payout object when present',
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  payout!: Record<string, any> | null;

  @ApiProperty({
    description: 'Pricing details computed for display/read flows',
    type: TransactionPricingDetailsDto,
    nullable: true,
  })
  pricingDetails!: TransactionPricingDetailsDto | null;
}