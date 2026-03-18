import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class DismissAbandonmentEventDto {
  @ApiPropertyOptional({
    example: {
      reason: 'False positive',
      note: 'Dismissed by admin after review',
    },
    description: 'Optional metadata associated with the admin dismiss action',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}