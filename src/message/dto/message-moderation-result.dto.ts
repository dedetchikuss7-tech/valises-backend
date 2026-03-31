import { ApiProperty } from '@nestjs/swagger';

export class MessageModerationResultDto {
  @ApiProperty({
    description: 'Moderation status applied to the outgoing message',
    enum: ['CLEAN', 'SANITIZED', 'BLOCKED'],
    example: 'SANITIZED',
  })
  status!: 'CLEAN' | 'SANITIZED' | 'BLOCKED';

  @ApiProperty({
    description: 'Moderation reasons detected during sanitation',
    example: ['phone'],
    type: String,
    isArray: true,
  })
  reasons!: string[];
}