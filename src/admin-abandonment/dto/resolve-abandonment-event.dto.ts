import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class ResolveAbandonmentEventDto {
  @ApiPropertyOptional({
    example: {
      reason: 'User completed the flow manually',
      note: 'Resolved by admin after support review',
    },
    description: 'Optional metadata associated with the admin resolution action',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}