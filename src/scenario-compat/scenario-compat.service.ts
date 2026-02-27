import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

type CompatUser = {
  id: string;
  email: string;
  phone?: string;
  role?: string;
  createdAt: string;
  updatedAt: string;
};

type CompatTransaction = {
  id: string;
  senderId?: string | null;
  carrierId?: string | null;
  amount: number;
  currency: string;
  corridorCode?: string | null;

  status: string;
  paymentStatus: string;

  createdAt: string;
  updatedAt: string;
  raw?: any;
};

type CompatDispute = {
  id: string;
  transactionId: string;
  openedById?: string | null;
  reason?: string | null;
  reasonCode?: string | null;

  status: string; // OPEN/RESOLVED
  createdAt: string;
  updatedAt: string;

  resolution?: any;
  raw?: any;
};

@Injectable()
export class ScenarioCompatService {
  private readonly users = new Map<string, CompatUser>();
  private readonly transactions = new Map<string, CompatTransaction>();
  private readonly disputes = new Map<string, CompatDispute>();

  createUser(body: any) {
    const now = new Date().toISOString();
    const user: CompatUser = {
      id: randomUUID(),
      email: body?.email ?? `user_${Date.now()}@example.com`,
      phone: body?.phone,
      role: body?.role ?? 'USER',
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  normalizeKycLevel(input: { kycLevel?: any; kycStatus?: any }) {
    if (input.kycLevel !== undefined && input.kycLevel !== null) {
      const n = Number(input.kycLevel);
      if (Number.isFinite(n)) return Math.max(0, Math.min(3, Math.trunc(n)));
    }
    const status = String(input.kycStatus ?? '').trim().toUpperCase();
    if (!status) return 0;
    if (['NONE', 'INIT', 'NEW'].includes(status)) return 0;
    if (['PENDING', 'STARTED', 'IN_PROGRESS'].includes(status)) return 1;
    if (['SUBMITTED', 'REVIEW', 'UNDER_REVIEW'].includes(status)) return 2;
    if (['APPROVED', 'VERIFIED', 'PASSED', 'OK'].includes(status)) return 3;
    if (['REJECTED', 'FAILED', 'DENIED'].includes(status)) return 1;
    return 1;
  }

  updateKyc(userId: string, body: any) {
    const level = this.normalizeKycLevel({ kycLevel: body?.kycLevel, kycStatus: body?.kycStatus });
    return {
      ok: true,
      userId,
      kyc: { kycLevel: level, kycStatus: body?.kycStatus ?? null },
      updatedAt: new Date().toISOString(),
    };
  }

  createTransaction(body: any) {
    const now = new Date().toISOString();

    const amount =
      typeof body?.amount === 'number'
        ? body.amount
        : Number.isFinite(Number(body?.amount))
        ? Number(body.amount)
        : 1000;

    const tx: CompatTransaction = {
      id: randomUUID(),
      senderId: body?.senderId ?? body?.userId ?? null,
      carrierId: body?.carrierId ?? null,
      amount,
      currency: body?.currency ?? 'XAF',
      corridorCode: body?.corridorCode ?? body?.corridor ?? null,
      status: body?.status ?? 'CREATED',
      paymentStatus: body?.paymentStatus ?? 'PENDING',
      createdAt: now,
      updatedAt: now,
      raw: body,
    };

    this.transactions.set(tx.id, tx);
    return tx;
  }

  markPaymentSuccess(txId: string) {
    const tx = this.transactions.get(txId);
    if (!tx) return null;
    const now = new Date().toISOString();
    const updated: CompatTransaction = {
      ...tx,
      paymentStatus: 'SUCCESS',
      status: tx.status === 'CREATED' ? 'PAID' : tx.status,
      updatedAt: now,
    };
    this.transactions.set(txId, updated);
    return updated;
  }

  updateTxStatus(txId: string, body: any) {
    const tx = this.transactions.get(txId);
    if (!tx) return null;

    const incoming =
      body?.status ??
      body?.businessStatus ??
      body?.transactionStatus ??
      body?.state ??
      body?.newStatus;

    const newStatus = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : tx.status;

    const now = new Date().toISOString();
    const updated: CompatTransaction = {
      ...tx,
      status: newStatus,
      updatedAt: now,
      raw: { ...(tx.raw ?? {}), lastStatusPatch: body },
    };
    this.transactions.set(txId, updated);
    return updated;
  }

  createDispute(body: any) {
    const now = new Date().toISOString();
    const dispute: CompatDispute = {
      id: randomUUID(),
      transactionId: body?.transactionId ?? body?.transaction_id ?? body?.txId ?? '',
      openedById: body?.openedById ?? body?.opened_by_id ?? body?.userId ?? null,
      reason: body?.reason ?? null,
      reasonCode: body?.reasonCode ?? body?.reason_code ?? null,
      status: body?.status ?? 'OPEN',
      createdAt: now,
      updatedAt: now,
      raw: body,
    };
    this.disputes.set(dispute.id, dispute);
    return dispute;
  }

  getDisputeRecommendation(disputeId: string) {
    const d = this.disputes.get(disputeId);
    if (!d) return null;

    // Stub that looks like DisputeMatrix output
    return {
      disputeId,
      recommendation: 'SPLIT',
      refundAmount: 500,
      releaseAmount: 500,
      currency: 'XAF',
      rationale: 'Scenario compat recommendation (stub).',
    };
  }

  resolveDispute(disputeId: string, body: any) {
    const existing = this.disputes.get(disputeId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: CompatDispute = {
      ...existing,
      status: 'RESOLVED',
      updatedAt: now,
      resolution: body ?? {},
    };
    this.disputes.set(disputeId, updated);
    return updated;
  }

  getLedger(txId: string) {
    const tx = this.transactions.get(txId);
    if (!tx) return null;

    // ✅ IMPORTANT: avoid TS "never[]" inference by explicit typing
    const entries: any[] = [];

    if (tx.paymentStatus === 'SUCCESS') {
      entries.push({
        type: 'ESCROW_CREDIT',
        amount: tx.amount,
        currency: tx.currency,
        createdAt: tx.updatedAt,
      });
    }

    return { transactionId: txId, entries };
  }
}