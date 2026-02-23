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

  it('assertCanTransition throws on invalid transition', () => {
    expect(() =>
      TransactionStateMachine.assertCanTransition(
        TransactionStatus.CREATED,
        TransactionStatus.DELIVERED,
      ),
    ).toThrow();
  });
});