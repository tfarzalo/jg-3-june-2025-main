import { describe, expect, it } from 'vitest';

import { calculateBillingTotals } from './reports';

describe('report miscellaneous-cost fallback', () => {
  it('does not add legacy repair pay when the structured array is explicitly empty', () => {
    const totals = calculateBillingTotals({
      billing_details: { bill_amount: 100, sub_pay_amount: 50 },
      repair_amount: 0,
      repair_sub_pay: 40,
      work_order: {
        misc_additional_cost_items: [],
        extra_charges_line_items: [{
          quantity: 2,
          billRate: 0,
          subRate: 20,
          calculatedBillAmount: 0,
          calculatedSubAmount: 40,
        }],
      },
    }, { id: 'wo-010918' });

    expect(totals.sub).toBe(90);
    expect(totals.extraSub).toBe(40);
    expect(totals.miscAdditionalCostSubPay).toBe(0);
    expect(totals.miscAdditionalCostItems).toEqual([]);
  });

  it('retains legacy fallback when the structured field is absent', () => {
    const totals = calculateBillingTotals({
      billing_details: { bill_amount: 100, sub_pay_amount: 50 },
      repair_amount: 0,
      repair_sub_pay: 40,
      work_order: { extra_charges_line_items: [] },
    }, { id: 'legacy-work-order' });

    expect(totals.miscAdditionalCostSubPay).toBe(40);
  });

  it('does not use legacy fallback for malformed structured data', () => {
    const totals = calculateBillingTotals({
      billing_details: { bill_amount: 100, sub_pay_amount: 50 },
      repair_amount: 25,
      repair_sub_pay: 40,
      work_order: { misc_additional_cost_items: { price: 25 } },
    }, { id: 'malformed-work-order' });

    expect(totals.miscAdditionalCostBill).toBe(0);
    expect(totals.miscAdditionalCostSubPay).toBe(0);
  });
});
