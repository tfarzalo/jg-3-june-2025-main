import { describe, expect, it } from 'vitest';

import { shouldUseLegacyMiscAdditionalCostFallback } from './miscAdditionalCostEditing';

describe('shouldUseLegacyMiscAdditionalCostFallback', () => {
  it('treats an explicitly empty array as no miscellaneous charges', () => {
    expect(shouldUseLegacyMiscAdditionalCostFallback([])).toBe(false);
  });

  it('uses legacy values when the structured field is absent', () => {
    expect(shouldUseLegacyMiscAdditionalCostFallback(undefined)).toBe(true);
    expect(shouldUseLegacyMiscAdditionalCostFallback(null)).toBe(true);
  });

  it('uses structured values when the array contains items', () => {
    expect(shouldUseLegacyMiscAdditionalCostFallback([{ price: 10, subPay: 5 }])).toBe(false);
  });

  it('does not revive legacy values for malformed structured data', () => {
    expect(shouldUseLegacyMiscAdditionalCostFallback({ price: 10 })).toBe(false);
    expect(shouldUseLegacyMiscAdditionalCostFallback('invalid')).toBe(false);
  });
});
