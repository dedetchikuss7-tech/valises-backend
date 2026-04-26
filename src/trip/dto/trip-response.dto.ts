import { ApiProperty } from '@nestjs/swagger';
import { FlightTicketStatus, TripStatus } from '@prisma/client';

export class TripResponseDto {
  @ApiProperty({
    description: 'Trip ID',
    example: '59dabd86-3632-4168-8b6f-17592ff35f61',
  })
  id!: string;

  @ApiProperty({
    description: 'Carrier user ID',
    example: 'e243bcc1-38bf-4722-86ac-aa7119eee4a7',
  })
  carrierId!: string;

  @ApiProperty({
    description: 'Corridor ID',
    example: '30fa8e47-ac12-4745-9058-4eb8bf490cac',
  })
  corridorId!: string;

  @ApiProperty({
    description: 'Planned departure datetime',
    example: '2026-04-10T08:00:00.000Z',
  })
  departAt!: Date;

  @ApiProperty({
    description: 'Available capacity in kg when provided',
    example: 23,
    nullable: true,
  })
  capacityKg!: number | null;

  @ApiProperty({
    description: 'Trip publication status',
    enum: TripStatus,
    example: TripStatus.DRAFT,
  })
  status!: TripStatus;

  @ApiProperty({
    description: 'Flight ticket verification status',
    enum: FlightTicketStatus,
    example: FlightTicketStatus.NOT_PROVIDED,
  })
  flightTicketStatus!: FlightTicketStatus;

  @ApiProperty({
    description: 'Optional airline booking reference or ticket reference',
    example: 'AF-ABC123',
    nullable: true,
  })
  flightTicketRef!: string | null;

  @ApiProperty({
    description: 'Original flight ticket file name',
    example: 'flight-ticket.pdf',
    nullable: true,
  })
  flightTicketFileName!: string | null;

  @ApiProperty({
    description: 'Flight ticket MIME type',
    example: 'application/pdf',
    nullable: true,
  })
  flightTicketMimeType!: string | null;

  @ApiProperty({
    description: 'Flight ticket file size in bytes',
    example: 450000,
    nullable: true,
  })
  flightTicketSizeBytes!: number | null;

  @ApiProperty({
    description: 'Storage provider for flight ticket',
    example: 'MOCK_STORAGE',
    nullable: true,
  })
  flightTicketProvider!: string | null;

  @ApiProperty({
    description: 'Provider upload id when returned by storage provider',
    example: 'mock-upload:pending/trips/trip1/flight-ticket/file.pdf',
    nullable: true,
  })
  flightTicketProviderUploadId!: string | null;

  @ApiProperty({
    description: 'Storage key for flight ticket',
    example: 'pending/trips/trip1/flight-ticket/user1/flight-ticket.pdf',
    nullable: true,
  })
  flightTicketStorageKey!: string | null;

  @ApiProperty({
    description: 'Object URL for flight ticket',
    example: 'https://mock-storage.local/object/...',
    nullable: true,
  })
  flightTicketObjectUrl!: string | null;

  @ApiProperty({
    description: 'Public URL for flight ticket when available',
    example: null,
    nullable: true,
  })
  flightTicketPublicUrl!: string | null;

  @ApiProperty({
    description: 'Flight ticket submission timestamp',
    example: '2026-04-02T10:20:00.000Z',
    nullable: true,
  })
  flightTicketSubmittedAt!: Date | null;

  @ApiProperty({
    description: 'User ID who submitted the flight ticket',
    example: 'traveler-user-id',
    nullable: true,
  })
  flightTicketSubmittedById!: string | null;

  @ApiProperty({
    description: 'Ticket rejection reason when rejected',
    example: 'Ticket is unreadable.',
    nullable: true,
  })
  flightTicketRejectionReason!: string | null;

  @ApiProperty({
    description: 'Admin review notes for ticket',
    example: 'Ticket verified manually.',
    nullable: true,
  })
  flightTicketReviewNotes!: string | null;

  @ApiProperty({
    description: 'Timestamp of ticket verification when verified',
    example: '2026-04-02T10:30:00.000Z',
    nullable: true,
  })
  verifiedAt!: Date | null;

  @ApiProperty({
    description: 'Admin user ID who verified the ticket when applicable',
    example: 'admin-user-id',
    nullable: true,
  })
  verifiedById!: string | null;

  @ApiProperty({
    description: 'Trip creation timestamp',
    example: '2026-04-01T09:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Trip last update timestamp',
    example: '2026-04-01T09:10:00.000Z',
  })
  updatedAt!: Date;
}