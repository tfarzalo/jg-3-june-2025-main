import { describe, expect, it } from 'vitest';

import { resolveJobBillingTotals } from './resolveJobBillingTotals';

describe('resolveJobBillingTotals', () => {
  it('keeps an empty structured misc array authoritative over stale mirrors', () => {
    const totals = resolveJobBillingTotals({
      billing_details: { bill_amount: 100, sub_pay_amount: 50 },
      repair_amount: 0,
      repair_sub_pay: 120,
      work_order: {
        misc_additional_cost_items: [],
        extra_charges_line_items: [{
          quantity: 6,
          billRate: 40,
          subRate: 20,
          calculatedBillAmount: 0,
          calculatedSubAmount: 120,
        }],
      },
    });

    expect(totals.miscSubPay).toBe(0);
    expect(totals.standardExtraSubPay).toBe(120);
    expect(totals.totalSubPay).toBe(170);
  });

  it('uses legacy miscellaneous values only when the structured field is absent', () => {
    const totals = resolveJobBillingTotals({
      repair_amount: 25,
      repair_sub_pay: 10,
      work_order: {},
    });
    expect(totals.miscBill).toBe(25);
    expect(totals.miscSubPay).toBe(10);
    expect(totals.sources.miscellaneous).toBe('legacy');
  });

  it('uses frozen supplemental lines only for snapshot-backed details', () => {
    const input = {
      work_order: {
        additional_services: [{ amountBill: 75, amountSub: 25 }],
        frozen_billing_lines: [{ amountBill: 120, amountSub: 60 }],
      },
    };
    expect(resolveJobBillingTotals(input).supplementalBill).toBe(75);
    expect(resolveJobBillingTotals({ ...input, historical_data_mode: 'snapshot' }).supplementalBill).toBe(120);
  });

  it('does not add legacy and structured standard extras together', () => {
    const totals = resolveJobBillingTotals({
      extra_charges_details: { bill_amount: 200, sub_pay_amount: 100 },
      work_order: {
        extra_charges_line_items: [{
          quantity: 2,
          billRate: 40,
          subRate: 20,
          calculatedBillAmount: 80,
          calculatedSubAmount: 40,
        }],
      },
    });
    expect(totals.standardExtraBill).toBe(80);
    expect(totals.standardExtraSubPay).toBe(40);
  });

  it('returns zero for a cancelled job without a trip charge', () => {
    const totals = resolveJobBillingTotals({
      job_phase: { job_phase_label: 'Cancelled' },
      cancellation_trip_charge_added: false,
      billing_details: { bill_amount: 500, sub_pay_amount: 300 },
      work_order: {
        additional_services: [{ amountBill: 100, amountSub: 50 }],
      },
    });

    expect(totals.totalBill).toBe(0);
    expect(totals.totalSubPay).toBe(0);
    expect(totals.sources.total).toBe('cancellation');
  });

  it('uses only the explicit trip charge for a cancelled job', () => {
    const totals = resolveJobBillingTotals({
      snapshot_phase_label: 'Cancelled',
      cancellation_trip_charge_added: true,
      cancellation_trip_charge_bill_amount: 90,
      cancellation_trip_charge_sub_pay_amount: 45,
      billing_details: { bill_amount: 500, sub_pay_amount: 300 },
    });

    expect(totals.totalBill).toBe(90);
    expect(totals.totalSubPay).toBe(45);
    expect(totals.baseBill).toBe(0);
  });
});
