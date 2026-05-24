import { Logger } from '@nestjs/common';

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  callTimeoutMs?: number;
  maxTotalDurationMs?: number;
  isRetryable?: (error: unknown) => boolean;
  logger?: Pick<Logger, 'warn'>;
  operationName?: string;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    attempts,
    baseDelayMs,
    maxDelayMs,
    maxTotalDurationMs,
    isRetryable,
    logger,
    operationName = 'operation',
  } = options;

  const startTime = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (maxTotalDurationMs && Date.now() - startTime >= maxTotalDurationMs) {
      throw lastError ?? new Error(`${operationName}: total duration budget exhausted`);
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const shouldRetry = isRetryable ? isRetryable(error) : true;
      const isLastAttempt = attempt === attempts;

      if (!shouldRetry || isLastAttempt) {
        throw error;
      }

      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * baseDelayMs * 0.5);
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger?.warn(
        `[${operationName}] Attempt ${attempt}/${attempts} failed: ${errorMessage}. Retrying in ${Math.round(delay)}ms`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function isCinetPayRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const status =
      (error as any).status ??
      (error as any).statusCode ??
      (error as any).response?.status;

    if ([400, 401, 403, 404, 422].includes(Number(status))) {
      return false;
    }

    if (status === undefined || status === null) {
      return true;
    }
  }

  return true;
}
