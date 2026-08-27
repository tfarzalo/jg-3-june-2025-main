import { describe, expect, it } from 'vitest';
import { calculateBillingTotals } from '../src/lib/reports';

const baseJob = {
  id: 'job-1',
  total_billing_amount: 0,
  job_phase: { job_phase_label: 'Completed Work Orders' },
};

const detailsWithWorkOrder = (workOrder: Record<string, unknown>) => ({
  work_order: workOrder,
  billing_details: {
    bill_amount: 100,
    sub_pay_amount: 50,
  },
});

describe('report misc additional cost mapping', () => {
  it('keeps misc cost out of numbered Extra Charge items when there are no extra charges', () => {
    const totals = calculateBillingTotals(
      detailsWithWorkOrder({
        misc_additional_cost_items: [
          { description: 'Paint supplies', price: 25, subPay: 10 },
        ],
      }),
      baseJob
    );

    expect(totals.bill).toBe(125);
    expect(totals.sub).toBe(60);
    expect(totals.miscAdditionalCostDescription).toBe('Paint supplies');
    expect(totals.miscAdditionalCostBill).toBe(25);
    expect(totals.miscAdditionalCostSubPay).toBe(10);
    expect(totals.extra).toBe(0);
    expect(totals.extraSub).toBe(0);
    expect(totals.extraItems).toEqual([]);
  });

  it('reports legitimate extra charges without misc cost duplication', () => {
    const totals = calculateBillingTotals(
      detailsWithWorkOrder({
        extra_charges_line_items: [
          {
            categoryName: 'Accent Walls',
            detailName: '1 Bedroom',
            description: 'Accent wall',
            quantity: 1,
            billRate: 200,
            subRate: 100,
            calculatedBillAmount: 200,
            calculatedSubAmount: 100,
          },
        ],
        misc_additional_cost_items: [
          { description: 'Paint storage closet', price: 60, subPay: 30 },
        ],
      }),
      baseJob
    );

    expect(totals.bill).toBe(360);
    expect(totals.sub).toBe(180);
    expect(totals.extra).toBe(200);
    expect(totals.extraSub).toBe(100);
    expect(totals.extraItems).toHaveLength(1);
    expect(totals.extraItems?.[0]).toMatchObject({
      type: 'extra_charge',
      description: 'Accent wall',
      bill: 200,
      sub: 100,
    });
    expect(totals.miscAdditionalCostDescription).toBe('Paint storage closet');
    expect(totals.miscAdditionalCostBill).toBe(60);
    expect(totals.miscAdditionalCostSubPay).toBe(30);
  });

  it('reports extra charges correctly when no misc cost exists', () => {
    const totals = calculateBillingTotals(
      detailsWithWorkOrder({
        extra_charges_line_items: [
          {
            categoryName: 'Accent Walls',
            detailName: '1 Bedroom',
            description: 'Accent wall',
            quantity: 1,
            billRate: 200,
            subRate: 100,
            calculatedBillAmount: 200,
            calculatedSubAmount: 100,
          },
        ],
      }),
      baseJob
    );

    expect(totals.bill).toBe(300);
    expect(totals.sub).toBe(150);
    expect(totals.extra).toBe(200);
    expect(totals.extraSub).toBe(100);
    expect(totals.extraItems).toHaveLength(1);
    expect(totals.miscAdditionalCostDescription).toBe('');
    expect(totals.miscAdditionalCostBill).toBe(0);
    expect(totals.miscAdditionalCostSubPay).toBe(0);
  });

  it('keeps multiple legitimate extra charge slots independent from misc cost', () => {
    const totals = calculateBillingTotals(
      detailsWithWorkOrder({
        extra_charges_line_items: [
          { categoryName: 'Drywall', detailName: 'Patch', quantity: 1, billRate: 80, subRate: 40 },
          { categoryName: 'Accent Walls', detailName: '2 Bedroom', quantity: 1, billRate: 250, subRate: 125 },
          { categoryName: 'Trim', detailName: 'Repair', quantity: 1, billRate: 75, subRate: 35 },
        ],
        misc_additional_cost_items: [
          { description: 'Misc paint', price: 20, subPay: 5 },
        ],
      }),
      baseJob
    );

    expect(totals.bill).toBe(525);
    expect(totals.sub).toBe(255);
    expect(totals.extra).toBe(405);
    expect(totals.extraSub).toBe(200);
    expect(totals.extraItems).toHaveLength(3);
    expect(totals.extraItems?.map(item => item.description)).toEqual([
      'Drywall: Patch',
      'Accent Walls: 2 Bedroom',
      'Trim: Repair',
    ]);
    expect(totals.miscAdditionalCostDescription).toBe('Misc paint');
    expect(totals.miscAdditionalCostBill).toBe(20);
  });

  it('reports no misc or extra charge values when neither exists', () => {
    const totals = calculateBillingTotals(detailsWithWorkOrder({}), baseJob);

    expect(totals.bill).toBe(100);
    expect(totals.sub).toBe(50);
    expect(totals.extra).toBe(0);
    expect(totals.extraSub).toBe(0);
    expect(totals.extraItems).toEqual([]);
    expect(totals.miscAdditionalCostDescription).toBe('');
    expect(totals.miscAdditionalCostBill).toBe(0);
    expect(totals.miscAdditionalCostSubPay).toBe(0);
  });
});
