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

  it('rejects PAID -> IN_TRANSIT because IN_TRANSIT is not used in V1 operational flow', () => {
    expect(
      TransactionStateMachine.canTransition(
        TransactionStatus.PAID,
        TransactionStatus.IN_TRANSIT,
      ),
    ).toBe(false);
  });

  it('rejects PAID -> DELIVERED through generic state machine mutation', () => {
    expect(
      TransactionStateMachine.canTransition(
        TransactionStatus.PAID,
        TransactionStatus.DELIVERED,
      ),
    ).toBe(false);
  });

  it('allows PAID -> DISPUTED', () => {
    expect(
      TransactionStateMachine.canTransition(
        TransactionStatus.PAID,
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