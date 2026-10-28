import { describe, expect, it } from 'vitest';

import {
  getApprovalChargeHoursText,
  getApprovalChargeRateText,
  shouldShowApprovalChargeQuantity,
} from './approvalChargeDisplay';

describe('approval charge display', () => {
  it('hides operational quantity when customer bill hours are present', () => {
    const charge = { cost: 120, quantity: 2, hours: 2, bill_hours: 3, unit: 'hours' };

    expect(shouldShowApprovalChargeQuantity(charge)).toBe(false);
    expect(getApprovalChargeHoursText(charge)).toBe('3 hours');
    expect(getApprovalChargeRateText(charge)).toBe('Rate: $40.00/hr');
  });

  it('hides operational quantity when only legacy hours are present', () => {
    const charge = { cost: 120, quantity: 2, hours: 3, unit: 'hours' };

    expect(shouldShowApprovalChargeQuantity(charge)).toBe(false);
    expect(getApprovalChargeHoursText(charge)).toBe('3 hours');
    expect(getApprovalChargeRateText(charge)).toBe('Rate: $40.00/hr');
  });

  it('continues to show and price fixed-item quantities', () => {
    const charge = { cost: 60, quantity: 1, unit: 'item' };

    expect(shouldShowApprovalChargeQuantity(charge)).toBe(true);
    expect(getApprovalChargeHoursText(charge)).toBeNull();
    expect(getApprovalChargeRateText(charge)).toBe('Rate: $60.00 per item');
  });

  it('does not fall back to operational quantity when an hourly field is zero', () => {
    const charge = { cost: 120, quantity: 2, bill_hours: 0, unit: 'hours' };

    expect(shouldShowApprovalChargeQuantity(charge)).toBe(false);
    expect(getApprovalChargeRateText(charge)).toBeNull();
  });
});
