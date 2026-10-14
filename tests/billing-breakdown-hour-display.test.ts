import { describe, expect, it } from 'vitest';
import { getLineItemBillHours } from '../src/utils/extraChargesCalculations';

describe('billing breakdown hourly quantity display', () => {
  it('uses customized bill hours for an hourly item summary', () => {
    expect(getLineItemBillHours({
      id: 'repair-hours',
      categoryId: 'repair',
      categoryName: 'Repair',
      detailId: 'other',
      detailName: 'Other',
      jobBillingCategory: 'repair',
      quantity: 2.5,
      isHourly: true,
      customizeHours: true,
      billHours: 2,
      subPayHours: 2,
      billRate: 40,
      subRate: 20,
      calculatedBillAmount: 80,
      calculatedSubAmount: 40,
    })).toBe(2);
  });
});
