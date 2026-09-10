export class RetryableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RetryableError";
  }
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
}

export async function withBoundedRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 25;
  const sleep = options.sleep ?? defaultSleep;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new Error("maxAttempts must be an integer from 1 through 3");
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0 || baseDelayMs > 1_000) {
    throw new Error("baseDelayMs must be from 0 through 1000");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!(error instanceof RetryableError) || attempt === maxAttempts) {
        throw error;
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error("Unreachable retry state");
}

async function defaultSleep(delayMs: number): Promise<void> {
  if (delayMs === 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
