import { ApiProperty } from '@nestjs/swagger';
import { AdminTransactionOperationalTimelineEventDto } from './admin-transaction-operational-timeline-event.dto';

export class AdminTransactionOperationalTimelineResponseDto {
  @ApiProperty()
  transactionId!: string;

  @ApiProperty({
    type: AdminTransactionOperationalTimelineEventDto,
    isArray: true,
  })
  items!: AdminTransactionOperationalTimelineEventDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  generatedAt!: Date;
}