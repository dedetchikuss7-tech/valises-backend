import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AdminVerifyDecision {
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export class AdminVerifyTicketDto {
  @ApiProperty({
    enum: AdminVerifyDecision,
    example: AdminVerifyDecision.VERIFIED,
  })
  @IsEnum(AdminVerifyDecision)
  decision!: AdminVerifyDecision;

  @ApiPropertyOptional({
    description: 'Admin review notes',
    example: 'Ticket is readable and consistent with the declared corridor.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNotes?: string;

  @ApiPropertyOptional({
    description: 'Required business reason when rejecting the ticket',
    example: 'Ticket is unreadable or does not match declared trip.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}