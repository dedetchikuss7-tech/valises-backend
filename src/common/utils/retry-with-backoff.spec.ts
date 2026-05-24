import { retryWithBackoff, isCinetPayRetryableError, RetryOptions } from './retry-with-backoff';

const INSTANT: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs'> = {
  baseDelayMs: 0,
  maxDelayMs: 0,
};

describe('retryWithBackoff', () => {
  it('returns result if first call succeeds (no retry)', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { ...INSTANT, attempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and returns result when first call fails then second succeeds', async () => {
    const error = new Error('transient');
    const fn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('recovered');
    const result = await retryWithBackoff(fn, { ...INSTANT, attempts: 3 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after N attempts exhausted', async () => {
    const error = new Error('always fails');
    const fn = jest.fn().mockRejectedValue(error);
    await expect(retryWithBackoff(fn, { ...INSTANT, attempts: 3 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry when isRetryable returns false', async () => {
    const error = new Error('definitive');
    const fn = jest.fn().mockRejectedValue(error);
    await expect(
      retryWithBackoff(fn, {
        ...INSTANT,
        attempts: 3,
        isRetryable: () => false,
      }),
    ).rejects.toThrow('definitive');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aborts early when maxTotalDurationMs is exceeded', async () => {
    const dateSpy = jest.spyOn(Date, 'now');
    dateSpy
      .mockReturnValueOnce(0)     // startTime
      .mockReturnValueOnce(0)     // check before attempt 1 → not exceeded
      .mockReturnValue(5000);     // check before attempt 2+ → exceeded

    const error = new Error('timeout');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(
      retryWithBackoff(fn, {
        ...INSTANT,
        attempts: 5,
        maxTotalDurationMs: 4000,
      }),
    ).rejects.toThrow('timeout');

    expect(fn).toHaveBeenCalledTimes(1);
    dateSpy.mockRestore();
  });

  it('logs warn message on each retry when logger provided', async () => {
    const error = new Error('boom');
    const fn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('done');

    const logger = { warn: jest.fn() };
    await retryWithBackoff(fn, {
      ...INSTANT,
      attempts: 3,
      logger,
      operationName: 'testOp',
    });

    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[testOp] Attempt 1/3 failed'),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[testOp] Attempt 2/3 failed'),
    );
  });
});

describe('isCinetPayRetryableError', () => {
  it('returns false for status 400', () => {
    expect(isCinetPayRetryableError({ status: 400 })).toBe(false);
  });

  it('returns false for status 401', () => {
    expect(isCinetPayRetryableError({ status: 401 })).toBe(false);
  });

  it('returns true for status 503', () => {
    expect(isCinetPayRetryableError({ status: 503 })).toBe(true);
  });

  it('returns true for unknown error (no status)', () => {
    expect(isCinetPayRetryableError(new Error('network error'))).toBe(true);
  });

  it('returns false for statusCode 403', () => {
    expect(isCinetPayRetryableError({ statusCode: 403 })).toBe(false);
  });

  it('returns false for statusCode 404', () => {
    expect(isCinetPayRetryableError({ statusCode: 404 })).toBe(false);
  });

  it('returns false for statusCode 422', () => {
    expect(isCinetPayRetryableError({ statusCode: 422 })).toBe(false);
  });

  it('returns true for status 500', () => {
    expect(isCinetPayRetryableError({ status: 500 })).toBe(true);
  });

  it('returns true for status 502', () => {
    expect(isCinetPayRetryableError({ status: 502 })).toBe(true);
  });

  it('returns true for null error', () => {
    expect(isCinetPayRetryableError(null)).toBe(true);
  });
});
