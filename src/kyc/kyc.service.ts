import { Injectable } from '@nestjs/common';

@Injectable()
export class KycService {
  private normalizeKycLevel(input: { kycLevel?: string; kycStatus?: string }) {
    // Priority: kycLevel if present and parseable, else map from kycStatus
    if (input.kycLevel !== undefined && input.kycLevel !== null) {
      const n = Number(input.kycLevel);
      if (Number.isFinite(n)) {
        // clamp to [0..3]
        const clamped = Math.max(0, Math.min(3, Math.trunc(n)));
        return clamped;
      }
    }

    const status = (input.kycStatus ?? '').trim().toUpperCase();

    // Map common statuses to levels
    // 0 = NONE / INIT
    // 1 = PENDING / STARTED
    // 2 = REVIEW / SUBMITTED
    // 3 = APPROVED / VERIFIED
    if (!status) return 0;
    if (['NONE', 'INIT', 'NEW'].includes(status)) return 0;
    if (['PENDING', 'STARTED', 'IN_PROGRESS'].includes(status)) return 1;
    if (['SUBMITTED', 'REVIEW', 'UNDER_REVIEW'].includes(status)) return 2;
    if (['APPROVED', 'VERIFIED', 'PASSED', 'OK'].includes(status)) return 3;
    if (['REJECTED', 'FAILED', 'DENIED'].includes(status)) return 1; // conservative

    // Unknown status -> default safe
    return 1;
  }

  async updateUserKycStatus(userId: string, payload: { kycLevel?: string; kycStatus?: string }) {
    const level = this.normalizeKycLevel(payload);

    // STUB: no DB write (same rationale as earlier)
    return {
      ok: true,
      userId,
      kyc: {
        kycLevel: level,
        kycStatus: payload.kycStatus ?? null,
      },
      note: 'KYC endpoint compat: accepts kycStatus/kycLevel and normalizes. No DB write.',
      updatedAt: new Date().toISOString(),
    };
  }
}