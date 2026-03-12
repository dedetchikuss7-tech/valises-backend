import { IsUUID } from 'class-validator';

export class ResolveAbandonedDto {
  @IsUUID()
  eventId!: string;
}