import { ApiProperty } from '@nestjs/swagger';
import { MessageItemDto } from './message-item.dto';
import { MessageModerationResultDto } from './message-moderation-result.dto';

export class SendMessageResponseDto {
  @ApiProperty({
    description: 'Transaction ID linked to the conversation',
    example: 'tx1',
  })
  transactionId!: string;

  @ApiProperty({
    description: 'Conversation ID',
    example: 'conv1',
  })
  conversationId!: string;

  @ApiProperty({
    description: 'Moderation result applied before storing the message',
    type: MessageModerationResultDto,
  })
  moderation!: MessageModerationResultDto;

  @ApiProperty({
    description: 'Stored message',
    type: MessageItemDto,
  })
  message!: MessageItemDto;
}