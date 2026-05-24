export class FraudCheckResultDto {
  blocked: boolean;
  reason?: string;
  flagged?: boolean;
  relatedUserIds?: string[];
  metadata?: Record<string, unknown>;
}
