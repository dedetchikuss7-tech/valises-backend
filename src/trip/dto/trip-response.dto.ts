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