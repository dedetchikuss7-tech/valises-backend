import { TransactionStateMachine } from './transaction-state-machine';
import { TransactionStatus } from '@prisma/client';

describe('TransactionStateMachine', () => {
  it('allows CREATED -> PAID', () => {
    expect(
      TransactionStateMachine.canTransition(
        TransactionStatus.CREATED,
        TransactionStatus.PAID,
      ),
    ).toBe(true);
  });

  it('rejects CREATED -> DELIVERED', () => {
    expect(
      TransactionStateMachine.canTransition(
        TransactionStatus.CREATED,
        TransactionStatus.DELIVERED,
      ),
    ).toBe(false);
  });

  it('rejects IN_TRANSIT -> DELIVERED because delivery must use code confirmation', () => {
    expect(
      TransactionStateMachine.canTransition(
        TransactionStatus.IN_TRANSIT,
        TransactionStatus.DELIVERED,
      ),
    ).toBe(false);
  });

  it('allows IN_TRANSIT -> DISPUTED', () => {
    expect(
      TransactionStateMachine.canTransition(
        TransactionStatus.IN_TRANSIT,
        TransactionStatus.DISPUTED,
      ),
    ).toBe(true);
  });

  it('assertCanTransition throws on invalid transition', () => {
    expect(() =>
      TransactionStateMachine.assertCanTransition(
        TransactionStatus.CREATED,
        TransactionStatus.DELIVERED,
      ),
    ).toThrow();
  });
});