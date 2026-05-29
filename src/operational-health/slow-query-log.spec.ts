import { slowQueryLog, SlowQueryEntry } from './slow-query-log';

describe('slowQueryLog', () => {
  beforeEach(() => {
    slowQueryLog.length = 0;
  });

  it('accepts entries', () => {
    const entry: SlowQueryEntry = {
      model: 'Transaction',
      action: 'findMany',
      duration: 650,
      timestamp: new Date().toISOString(),
    };
    slowQueryLog.push(entry);
    expect(slowQueryLog).toHaveLength(1);
    expect(slowQueryLog[0].duration).toBe(650);
  });

  it('can be cleared', () => {
    slowQueryLog.push({ model: 'User', action: 'findUnique', duration: 520, timestamp: '' });
    slowQueryLog.length = 0;
    expect(slowQueryLog).toHaveLength(0);
  });
});
