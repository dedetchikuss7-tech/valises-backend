import { BadRequestException } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';

type AllowedTransitions = Record<TransactionStatus, TransactionStatus[]>;

export class TransactionStateMachine {
  private static readonly allowed: AllowedTransitions = {
    CREATED: [TransactionStatus.PAID, TransactionStatus.CANCELLED],
    PAID: [
      TransactionStatus.IN_TRANSIT,
      TransactionStatus.CANCELLED,
      TransactionStatus.DISPUTED,
    ],
    IN_TRANSIT: [TransactionStatus.DISPUTED],
    DELIVERED: [TransactionStatus.DISPUTED],
    CANCELLED: [],
    DISPUTED: [],
  };

  static canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
    return this.allowed[from]?.includes(to) ?? false;
  }

  static assertCanTransition(from: TransactionStatus, to: TransactionStatus) {
    if (from === to) {
      throw new BadRequestException(`Transaction already in status ${from}`);
    }

    if (!this.canTransition(from, to)) {
      throw new BadRequestException(`Invalid transition: ${from} -> ${to}`);
    }
  }
}