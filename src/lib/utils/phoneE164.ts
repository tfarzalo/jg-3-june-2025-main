/**
 * E.164 U.S. phone number utilities
 *
 * These functions enforce the single canonical storage format for U.S. phone
 * numbers across the entire application:
 *
 *   +1XXXXXXXXXX   (e.g. +17135551234)
 *
 * Import these wherever a phone value is being STORED (insert / update).
 * For DISPLAY purposes continue using formatPhoneNumber() from formatUtils.ts,
 * which produces the user-friendly  713-555-1234  form.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Accepted input  →  stored output
 * ──────────────────────────────────────────────────────────────────────────
 *  7135551234        → +17135551234   (10 digits)
 *  17135551234       → +17135551234   (11 digits, leading 1)
 *  (713) 555-1234    → +17135551234   (formatted)
 *  713-555-1234      → +17135551234   (dashed)
 *  713.555.1234      → +17135551234   (dotted)
 *  +17135551234      → +17135551234   (already E.164)
 *  ""  /  "   "      → null           (empty / whitespace → stored as NULL)
 *  null / undefined  → null
 *  "abc"             → null           (invalid — rejected or nulled per context)
 *  "555"             → null           (too short)
 * ──────────────────────────────────────────────────────────────────────────
 */

/**
 * Normalize any reasonable U.S. phone input to E.164 format (+1XXXXXXXXXX).
 *
 * Returns:
 *  - null  if the input is empty / whitespace / null / undefined
 *  - null  if the input cannot be converted to a valid U.S. number
 *  - "+1XXXXXXXXXX"  on success
 */
export function normalizeToE164US(phone: string | null | undefined): string | null {
  if (phone == null) return null;

  const trimmed = phone.trim();
  if (trimmed === '') return null;

  // Strip everything that isn't a digit
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 0) return null;

  // 10 digits — plain U.S. number, prepend +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // 11 digits starting with 1 — already has country code, prepend +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Any other length / prefix — not a valid U.S. number
  return null;
}

/**
 * Returns true only when the value is already a strictly valid E.164 U.S.
 * phone number: + followed by 1 and exactly 10 digits.
 *
 * null / undefined always return false; check intent with isStorablePhone()
 * if you want to allow absence.
 */
export function isValidE164US(phone: string | null | undefined): boolean {
  if (phone == null) return false;
  return /^\+1\d{10}$/.test(phone);
}

/**
 * Returns true for values that are safe to store in the database:
 *  - null / undefined / empty string  → stored as NULL     → acceptable
 *  - non-empty string that normalizes → valid E.164         → acceptable
 *  - non-empty string that can't normalize                  → NOT acceptable
 */
export function isStorablePhone(phone: string | null | undefined): boolean {
  if (phone == null || (typeof phone === 'string' && phone.trim() === '')) {
    return true; // null is fine — caller stores NULL
  }
  return isValidE164US(normalizeToE164US(phone));
}

/**
 * Normalize for storage, throwing a descriptive error when the input is
 * non-empty but cannot be converted.  Use this in write paths.
 *
 * @throws Error with a user-safe message when input is invalid and non-empty.
 */
export function requireE164US(
  phone: string | null | undefined,
  fieldLabel = 'phone number'
): string | null {
  if (phone == null || (typeof phone === 'string' && phone.trim() === '')) {
    return null;
  }

  const normalized = normalizeToE164US(phone);
  if (normalized === null) {
    throw new Error(
      `Invalid ${fieldLabel}: "${phone}". Please enter a valid U.S. phone number (e.g. 7135551234 or +17135551234).`
    );
  }

  return normalized;
}
