export class SaveConfirmationTimeoutError extends Error {
  constructor(public readonly stage: string) {
    super(`Timed out while waiting for ${stage}`);
    this.name = 'SaveConfirmationTimeoutError';
  }
}

export async function withSaveTimeout<T>(
  operation: PromiseLike<T>,
  stage: string,
  timeoutMs = 20_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SaveConfirmationTimeoutError(stage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function workOrderSaveMatches(
  saved: Record<string, unknown> | null | undefined,
  expected: Record<string, unknown>,
): boolean {
  if (!saved || saved.job_id !== expected.job_id) return false;
  const keys = Object.keys(expected).filter(key => key !== 'id' && expected[key] !== undefined);
  return keys.every(key => JSON.stringify(saved[key] ?? null) === JSON.stringify(expected[key] ?? null));
}
