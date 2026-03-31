import { ApiProperty } from '@nestjs/swagger';

export class MessageItemDto {
  @ApiProperty({
    description: 'Message ID',
    example: 'msg1',
  })
  id!: string;

  @ApiProperty({
    description: 'Conversation ID',
    example: 'conv1',
    required: false,
    nullable: true,
  })
  conversationId?: string | null;

  @ApiProperty({
    description: 'Sender user ID',
    example: 'sender1',
  })
  senderId!: string;

  @ApiProperty({
    description: 'Stored message content after sanitation if applicable',
    example: 'Bonjour [phone redacted]',
  })
  content!: string;

  @ApiProperty({
    description: 'Whether the stored content was redacted before persistence',
    example: true,
  })
  isRedacted!: boolean;

  @ApiProperty({
    description: 'Message creation timestamp',
    example: '2026-04-01T09:30:00.000Z',
  })
  createdAt!: Date;
}