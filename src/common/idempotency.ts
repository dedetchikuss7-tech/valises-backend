export type IdempotencyScope =
  | 'payment_success'
  | 'release'
  | 'commission_accrual'
  | 'dispute_resolve'
  | 'dispute_refund'
  | 'dispute_release';

/**
 * Centralized idempotency key generator.
 * Keeps keys consistent across the codebase.
 */
export const Idempotency = {
  tx(scope: IdempotencyScope, transactionId: string) {
    return `${scope}:${transactionId}`;
  },

  dispute(scope: IdempotencyScope, disputeId: string) {
    return `${scope}:${disputeId}`;
  },

  // For cases where we want a stable sub-key under a transaction scope
  txSub(scope: IdempotencyScope, transactionId: string, sub: string) {
    return `${scope}:${transactionId}:${sub}`;
  },
};