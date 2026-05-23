import { IsIn } from 'class-validator';

export class ApplyResolutionTemplateDto {
  @IsIn(['REFUND_FULL', 'REFUND_PARTIAL', 'RELEASE_TRAVELER', 'NO_ACTION'])
  template!: 'REFUND_FULL' | 'REFUND_PARTIAL' | 'RELEASE_TRAVELER' | 'NO_ACTION';
}
