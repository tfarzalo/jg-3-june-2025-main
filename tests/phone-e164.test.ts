/**
 * Unit tests for src/lib/utils/phoneE164.ts
 *
 * Run with:  npx vitest run tests/phone-e164.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeToE164US,
  isValidE164US,
  isStorablePhone,
  requireE164US,
} from '../src/lib/utils/phoneE164';

// ─── normalizeToE164US ────────────────────────────────────────────────────────

describe('normalizeToE164US', () => {
  // Happy-path conversions
  it('converts 10-digit string', () => {
    expect(normalizeToE164US('7135551234')).toBe('+17135551234');
  });

  it('converts 11-digit string starting with 1', () => {
    expect(normalizeToE164US('17135551234')).toBe('+17135551234');
  });

  it('converts (713) 555-1234', () => {
    expect(normalizeToE164US('(713) 555-1234')).toBe('+17135551234');
  });

  it('converts 713-555-1234', () => {
    expect(normalizeToE164US('713-555-1234')).toBe('+17135551234');
  });

  it('converts 713.555.1234', () => {
    expect(normalizeToE164US('713.555.1234')).toBe('+17135551234');
  });

  it('passes through already-valid +17135551234', () => {
    expect(normalizeToE164US('+17135551234')).toBe('+17135551234');
  });

  it('handles leading / trailing whitespace', () => {
    expect(normalizeToE164US('  7135551234  ')).toBe('+17135551234');
  });

  it('handles real-world number +17049603722', () => {
    expect(normalizeToE164US('7049603722')).toBe('+17049603722');
  });

  // Null / empty cases → null
  it('returns null for null', () => expect(normalizeToE164US(null)).toBeNull());
  it('returns null for undefined', () => expect(normalizeToE164US(undefined)).toBeNull());
  it('returns null for empty string', () => expect(normalizeToE164US('')).toBeNull());
  it('returns null for whitespace-only', () => expect(normalizeToE164US('   ')).toBeNull());

  // Invalid inputs → null
  it('returns null for alphabetic junk', () => expect(normalizeToE164US('abc')).toBeNull());
  it('returns null for too-short number', () => expect(normalizeToE164US('555')).toBeNull());
  it('returns null for too-long number (15 digits)', () => {
    expect(normalizeToE164US('713555123499999')).toBeNull();
  });
  it('returns null for 11 digits not starting with 1', () => {
    expect(normalizeToE164US('27135551234')).toBeNull();
  });
  it('returns null for mixed alpha-numeric junk', () => {
    expect(normalizeToE164US('555-abc-1234')).toBeNull();
  });
  it('returns null for non-US country code prefix', () => {
    expect(normalizeToE164US('+447135551234')).toBeNull();
  });
});

// ─── isValidE164US ────────────────────────────────────────────────────────────

describe('isValidE164US', () => {
  it('accepts valid E.164', () => expect(isValidE164US('+17135551234')).toBe(true));
  it('accepts another valid E.164', () => expect(isValidE164US('+17049603722')).toBe(true));
  it('rejects null', () => expect(isValidE164US(null)).toBe(false));
  it('rejects undefined', () => expect(isValidE164US(undefined)).toBe(false));
  it('rejects un-normalized 10-digit string', () => expect(isValidE164US('7135551234')).toBe(false));
  it('rejects non-US country code', () => expect(isValidE164US('+447135551234')).toBe(false));
  it('rejects empty string', () => expect(isValidE164US('')).toBe(false));
  it('rejects display-formatted string', () => expect(isValidE164US('713-555-1234')).toBe(false));
});

// ─── isStorablePhone ──────────────────────────────────────────────────────────

describe('isStorablePhone', () => {
  it('accepts null (stored as NULL)', () => expect(isStorablePhone(null)).toBe(true));
  it('accepts undefined (stored as NULL)', () => expect(isStorablePhone(undefined)).toBe(true));
  it('accepts empty string (stored as NULL)', () => expect(isStorablePhone('')).toBe(true));
  it('accepts whitespace (stored as NULL)', () => expect(isStorablePhone('   ')).toBe(true));
  it('accepts normalizable 10-digit', () => expect(isStorablePhone('7135551234')).toBe(true));
  it('accepts already-valid E.164', () => expect(isStorablePhone('+17135551234')).toBe(true));
  it('rejects alphabetic junk', () => expect(isStorablePhone('abc')).toBe(false));
  it('rejects too-short number', () => expect(isStorablePhone('555')).toBe(false));
});

// ─── requireE164US ────────────────────────────────────────────────────────────

describe('requireE164US', () => {
  it('normalizes valid input', () => {
    expect(requireE164US('7135551234')).toBe('+17135551234');
  });

  it('returns null for null', () => {
    expect(requireE164US(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(requireE164US('')).toBeNull();
  });

  it('throws descriptive error for invalid input', () => {
    expect(() => requireE164US('abc', 'sms_phone')).toThrow(/Invalid sms_phone/);
  });

  it('throws for too-short number', () => {
    expect(() => requireE164US('555')).toThrow(/Invalid/);
  });

  it('includes the bad value in the error message', () => {
    expect(() => requireE164US('notaphone')).toThrow(/notaphone/);
  });
});
