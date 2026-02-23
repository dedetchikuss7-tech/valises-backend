import { DisputeMatrixService } from './dispute-matrix.service';
import { DisputeReasonCode, EvidenceLevel, DisputeOutcome } from '@prisma/client';

describe('DisputeMatrixService', () => {
  const service = new DisputeMatrixService();

  it('rejects when evidence is NONE', () => {
    const r = service.recommend({
      reasonCode: DisputeReasonCode.NOT_DELIVERED,
      evidenceLevel: EvidenceLevel.NONE,
      isDelivered: false,
      isWithinDeliveryWindow: false,
    });
    expect(r.recommendedOutcome).toBe(DisputeOutcome.REJECT);
  });

  it('refunds sender for NOT_DELIVERED with STRONG evidence when not delivered', () => {
    const r = service.recommend({
      reasonCode: DisputeReasonCode.NOT_DELIVERED,
      evidenceLevel: EvidenceLevel.STRONG,
      isDelivered: false,
      isWithinDeliveryWindow: false,
    });
    expect(r.recommendedOutcome).toBe(DisputeOutcome.REFUND_SENDER);
  });

  it('splits for DAMAGED with STRONG evidence when delivered within window', () => {
    const r = service.recommend({
      reasonCode: DisputeReasonCode.DAMAGED,
      evidenceLevel: EvidenceLevel.STRONG,
      isDelivered: true,
      isWithinDeliveryWindow: true,
    });
    expect(r.recommendedOutcome).toBe(DisputeOutcome.SPLIT);
  });
});