import { ApiProperty } from '@nestjs/swagger';
import { PackageStatus } from '@prisma/client';

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