// src/transaction/transaction-state-machine.ts
import { TransactionStatus } from '@prisma/client';

export const transitions: Record<TransactionStatus, TransactionStatus[]> = {
  CREATED: [TransactionStatus.PAID, TransactionStatus.CANCELLED],
  PAID: [TransactionStatus.IN_TRANSIT, TransactionStatus.CANCELLED, TransactionStatus.DISPUTED],
  IN_TRANSIT: [TransactionStatus.DELIVERED, TransactionStatus.DISPUTED],
  DELIVERED: [TransactionStatus.DISPUTED],
  CANCELLED: [],
  DISPUTED: [],
};

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return (transitions[from] || []).includes(to);
}