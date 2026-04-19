import { ApiProperty } from '@nestjs/swagger';
import { FlightTicketStatus, KycStatus, TripStatus } from '@prisma/client';

class ShortlistTravelerSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: KycStatus })
  kycStatus!: KycStatus;
}

class ShortlistTripSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TripStatus })
  status!: TripStatus;

  @ApiProperty({ enum: FlightTicketStatus })
  flightTicketStatus!: FlightTicketStatus;

  @ApiProperty()
  departAt!: Date;

  @ApiProperty({ nullable: true })
  capacityKg!: number | null;

  @ApiProperty()
  corridorId!: string;
}

export class PackageTripShortlistResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  packageId!: string;

  @ApiProperty()
  tripId!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty()
  travelerId!: string;

  @ApiProperty()
  priorityRank!: number;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty()
  isVisible!: boolean;

  @ApiProperty({ type: ShortlistTravelerSummaryDto })
  traveler!: ShortlistTravelerSummaryDto;

  @ApiProperty({ type: ShortlistTripSummaryDto })
  trip!: ShortlistTripSummaryDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}