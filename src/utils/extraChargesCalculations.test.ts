import { describe, expect, it } from 'vitest';

import { normalizeSubcontractorExtraChargeHours } from './extraChargesCalculations';
import { ExtraChargeLineItem } from '../types/extraCharges';

describe('normalizeSubcontractorExtraChargeHours', () => {
  it('removes separate bill and sub-pay hours and recalculates from reported hours', () => {
    const item: ExtraChargeLineItem = {
      id: 'item-1',
      categoryId: 'category-1',
      categoryName: 'Repair',
      detailId: 'detail-1',
      detailName: 'Other',
      description: 'Forged admin description',
      quantity: 3,
      billRate: 40,
      subRate: 20,
      isHourly: true,
      customizeHours: true,
      billHours: 5,
      subPayHours: 2,
      hoursEditedAt: '2026-10-28T12:00:00Z',
      hoursEditedBy: 'forged-user',
      hoursEditedByName: 'Forged Admin',
      jobBillingCategory: 'tenant',
      notes: '',
      calculatedBillAmount: 200,
      calculatedSubAmount: 40,
    };

    const [normalized] = normalizeSubcontractorExtraChargeHours([item]);
    expect(normalized).toMatchObject({
      customizeHours: false,
      jobBillingCategory: 'owner',
      calculatedBillAmount: 120,
      calculatedSubAmount: 60,
    });
    expect(normalized).not.toHaveProperty('billHours');
    expect(normalized).not.toHaveProperty('subPayHours');
    expect(normalized).not.toHaveProperty('hoursEditedAt');
    expect(normalized).not.toHaveProperty('hoursEditedBy');
    expect(normalized).not.toHaveProperty('hoursEditedByName');
    expect(normalized).not.toHaveProperty('description');
  });
});
