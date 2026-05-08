import { ApiProperty } from '@nestjs/swagger';
import {
  KycStatus,
  PackageContentComplianceStatus,
  PackageStatus,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  Role,
  TransactionStatus,
  TripStatus,
  DisputeStatus,
  DisputeReasonCode,
  DisputeOpeningSource,
} from '@prisma/client';
import { TransactionPricingDetailsDto } from './transaction-pricing-details.dto';

class TransactionUserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ enum: KycStatus })
  kycStatus!: KycStatus;
}

class TransactionTripSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TripStatus })
  status!: TripStatus;

  @ApiProperty()
  flightTicketStatus!: string;

  @ApiProperty()
  departAt!: string;

  @ApiProperty()
  corridorId!: string;

  @ApiProperty()
  carrierId!: string;
}

class TransactionPackageSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PackageStatus })
  status!: PackageStatus;

  @ApiProperty()
  weightKg!: number;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  corridorId!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty({ enum: PackageContentComplianceStatus, nullable: true })
  contentComplianceStatus!: PackageContentComplianceStatus | null;

  @ApiProperty({ nullable: true })
  handoverDeclaredAt!: string | null;

  @ApiProperty({ nullable: true })
  travelerResponsibilityAcknowledgedAt!: string | null;

  @ApiProperty()
  hasContentDeclaration!: boolean;

  @ApiProperty()
  hasHandoverDeclaration!: boolean;

  @ApiProperty()
  hasTravelerResponsibilityAck!: boolean;

  @ApiProperty()
  isOperationallyReadyForTransit!: boolean;
}

class TransactionCorridorSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  status!: string;
}

class TransactionPayoutSnapshotDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PayoutStatus })
  status!: PayoutStatus;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;
}

class TransactionRefundSnapshotDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: RefundStatus })
  status!: RefundStatus;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;
}

class TransactionDisputeSnapshotDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: DisputeStatus })
  status!: DisputeStatus;

  @ApiProperty({ enum: DisputeReasonCode })
  reasonCode!: DisputeReasonCode;

  @ApiProperty({ enum: DisputeOpeningSource })
  openingSource!: DisputeOpeningSource;

  @ApiProperty()
  openedById!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true })
  resolutionOutcome!: string | null;
}

class TransactionDeliveryOperationalSnapshotDto {
  @ApiProperty()
  hasPackage!: boolean;

  @ApiProperty()
  hasTrip!: boolean;

  @ApiProperty()
  packageContentDeclared!: boolean;

  @ApiProperty()
  packageContentBlocked!: boolean;

  @ApiProperty()
  packageHandoverDeclared!: boolean;

  @ApiProperty()
  travelerResponsibilityAcknowledged!: boolean;

  @ApiProperty()
  deliveryCodeGenerated!: boolean;

  @ApiProperty()
  deliveryCodeConsumed!: boolean;

  @ApiProperty()
  deliveryConfirmed!: boolean;

  @ApiProperty()
  readyForTransit!: boolean;

  @ApiProperty()
  readyForDeliveryConfirmation!: boolean;

  @ApiProperty()
  requiresOperationalAttention!: boolean;

  @ApiProperty({ type: [String] })
  attentionSignals!: string[];
}

class TransactionAdminOperationalSnapshotDto {
  @ApiProperty()
  hasOpenDispute!: boolean;

  @ApiProperty()
  hasRequestedPayout!: boolean;

  @ApiProperty()
  hasRequestedRefund!: boolean;

  @ApiProperty()
  requiresAdminAttention!: boolean;
}

export class TransactionReadResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty()
  travelerId!: string;

  @ApiProperty()
  tripId!: string;

  @ApiProperty()
  packageId!: string;

  @ApiProperty()
  corridorId!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  commission!: number;

  @ApiProperty()
  escrowAmount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: TransactionStatus })
  status!: TransactionStatus;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty()
  contactDetailsMasked!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: TransactionUserSummaryDto })
  sender!: TransactionUserSummaryDto;

  @ApiProperty({ type: TransactionUserSummaryDto })
  traveler!: TransactionUserSummaryDto;

  @ApiProperty({ type: TransactionTripSummaryDto })
  trip!: TransactionTripSummaryDto;

  @ApiProperty({ type: TransactionPackageSummaryDto })
  package!: TransactionPackageSummaryDto;

  @ApiProperty({
    type: TransactionCorridorSummaryDto,
    nullable: true,
  })
  corridor!: TransactionCorridorSummaryDto | null;

  @ApiProperty({
    nullable: true,
    type: TransactionPayoutSnapshotDto,
  })
  payout!: TransactionPayoutSnapshotDto | null;

  @ApiProperty({
    nullable: true,
    type: TransactionRefundSnapshotDto,
  })
  refund!: TransactionRefundSnapshotDto | null;

  @ApiProperty({
    nullable: true,
    type: TransactionDisputeSnapshotDto,
  })
  dispute!: TransactionDisputeSnapshotDto | null;

  @ApiProperty({
    nullable: true,
    type: TransactionAdminOperationalSnapshotDto,
  })
  adminOperationalSnapshot!: TransactionAdminOperationalSnapshotDto | null;

  @ApiProperty({
    nullable: true,
    type: TransactionDeliveryOperationalSnapshotDto,
  })
  deliveryOperationalSnapshot!: TransactionDeliveryOperationalSnapshotDto | null;

  @ApiProperty({
    type: TransactionPricingDetailsDto,
    nullable: true,
  })
  pricingDetails!: TransactionPricingDetailsDto | null;
}