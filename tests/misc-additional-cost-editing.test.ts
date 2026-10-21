import { describe, expect, it } from 'vitest';
import {
  findBillingMetricDuplicateIds,
  shouldUseLegacyMiscAdditionalCostFallback,
} from '../src/lib/billing/miscAdditionalCostEditing';

describe('miscellaneous additional cost editing', () => {
  it('treats an explicitly saved empty list as authoritative', () => {
    expect(shouldUseLegacyMiscAdditionalCostFallback([])).toBe(false);
  });

  it('uses legacy fallback only when structured items are absent or malformed', () => {
    expect(shouldUseLegacyMiscAdditionalCostFallback(null)).toBe(true);
    expect(shouldUseLegacyMiscAdditionalCostFallback(undefined)).toBe(true);
    expect(shouldUseLegacyMiscAdditionalCostFallback({})).toBe(true);
  });

  it('flags a misc item that exactly duplicates the selected billing metric amounts', () => {
    expect(findBillingMetricDuplicateIds([
      { id: 'duplicate', description: 'Sub-entered service', price: 475, subPay: 300 },
      { id: 'other', description: 'Different service', price: 85, subPay: 50 },
    ], {
      label: 'Configured service',
      billAmount: 475,
      subPayAmount: 300,
    })).toEqual(['duplicate']);
  });

  it('is generic and does not flag different bill or sub-pay amounts', () => {
    expect(findBillingMetricDuplicateIds([
      { id: 'different-bill', price: 474, subPay: 300 },
      { id: 'different-sub-pay', price: 475, subPay: 299 },
    ], {
      billAmount: 475,
      subPayAmount: 300,
    })).toEqual([]);
  });
});
