import { IsOptional, IsString } from 'class-validator';

export class SubmitTicketDto {
  @IsOptional()
  @IsString()
  ticketRef?: string;
}