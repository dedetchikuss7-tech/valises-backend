export class DisputeSlaStatusDto {
  disputeId!: string;
  slaDeadline!: Date | null;
  hoursRemaining!: number | null;
  isOverdue!: boolean;
  status!: string;
}
