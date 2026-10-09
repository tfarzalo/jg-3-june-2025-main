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
  return getWorkOrderSaveMismatches(saved, expected).length === 0;
}

function normalizePersistedValue(value: unknown, inArray = false): unknown {
  if (value === undefined) return inArray ? null : undefined;
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(item => normalizePersistedValue(item, true));
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((normalized, key) => {
      const next = normalizePersistedValue((value as Record<string, unknown>)[key]);
      if (next !== undefined) normalized[key] = next;
      return normalized;
    }, {});
}

function persistedValuesMatch(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizePersistedValue(left ?? null)) ===
    JSON.stringify(normalizePersistedValue(right ?? null));
}

export function getWorkOrderSaveMismatches(
  saved: Record<string, unknown> | null | undefined,
  expected: Record<string, unknown>,
): string[] {
  if (!saved) return ['saved_record'];

  const keys = Object.keys(expected).filter(key => key !== 'id' && expected[key] !== undefined);
  return keys.filter(key => !persistedValuesMatch(saved[key], expected[key]));
}
