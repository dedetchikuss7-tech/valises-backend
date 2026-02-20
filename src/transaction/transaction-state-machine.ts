import { TransactionStatus } from '@prisma/client';

export const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  CREATED: ['PAID', 'CANCELLED'],
  PAID: ['IN_TRANSIT', 'CANCELLED', 'DISPUTED'],
  IN_TRANSIT: ['DELIVERED', 'DISPUTED'],
  DELIVERED: [], // état terminal
  CANCELLED: [], // état terminal
  DISPUTED: ['DELIVERED', 'CANCELLED'], // simplifié
};

export function assertCanTransition(from: TransactionStatus, to: TransactionStatus) {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid transition: ${from} -> ${to}`);
  }
}