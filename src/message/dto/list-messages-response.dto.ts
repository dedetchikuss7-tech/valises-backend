import { ApiProperty } from '@nestjs/swagger';
import { MessageItemDto } from './message-item.dto';

export class ListMessagesResponseDto {
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
    description: 'Messages ordered from most recent to oldest for the current page',
    type: MessageItemDto,
    isArray: true,
  })
  items!: MessageItemDto[];

  @ApiProperty({
    description: 'Cursor to request the next page, or null when there is no next page',
    example: 'msg1',
    nullable: true,
  })
  nextCursor!: string | null;
}