import { IsEnum } from 'class-validator';

export enum AdminVerifyDecision {
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export class AdminVerifyTicketDto {
  @IsEnum(AdminVerifyDecision)
  decision: AdminVerifyDecision;
}