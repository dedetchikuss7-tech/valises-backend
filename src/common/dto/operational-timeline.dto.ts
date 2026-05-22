import { ApiProperty } from '@nestjs/swagger';

export enum OperationalTimelineSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum OperationalTimelineCategory {
  TRANSACTION = 'TRANSACTION',
  PAYMENT = 'PAYMENT',
  DELIVERY = 'DELIVERY',
  DISPUTE = 'DISPUTE',
  EVIDENCE = 'EVIDENCE',
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
  ADMIN = 'ADMIN',
  COMPLIANCE = 'COMPLIANCE',
}

export enum OperationalTimelineActorType {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  ADMIN = 'ADMIN',
  PROVIDER = 'PROVIDER',
  UNKNOWN = 'UNKNOWN',
}

export class OperationalTimelineEventDto {
  @ApiProperty()
  type!: string;

  @ApiProperty({ enum: OperationalTimelineCategory })
  category!: OperationalTimelineCategory;

  @ApiProperty({ enum: OperationalTimelineSeverity })
  severity!: OperationalTimelineSeverity;

  @ApiProperty({ enum: OperationalTimelineActorType })
  actorType!: OperationalTimelineActorType;

  @ApiProperty({ nullable: true })
  actorId!: string | null;

  @ApiProperty()
  occurredAt!: Date;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: [String] })
  markers!: string[];

  @ApiProperty({ type: [String] })
  fraudSignals!: string[];

  @ApiProperty()
  financialImpact!: boolean;

  @ApiProperty()
  blocksAutomation!: boolean;
}

export class OperationalTimelineSnapshotDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  totalEvents!: number;

  @ApiProperty()
  criticalEvents!: number;

  @ApiProperty()
  highEvents!: number;

  @ApiProperty()
  warningEvents!: number;

  @ApiProperty()
  infoEvents!: number;

  @ApiProperty()
  hasBlockingEvent!: boolean;

  @ApiProperty()
  hasFinancialImpact!: boolean;

  @ApiProperty({ type: [String] })
  fraudSignals!: string[];

  @ApiProperty({ type: [OperationalTimelineEventDto] })
  events!: OperationalTimelineEventDto[];
}