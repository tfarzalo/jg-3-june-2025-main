import { describe, expect, it } from 'vitest';
import {
  SaveConfirmationTimeoutError,
  getWorkOrderSaveMismatches,
  withSaveTimeout,
  workOrderSaveMatches,
} from '../src/lib/workOrders/saveConfirmation';

describe('work-order save confirmation', () => {
  it('does not turn an unresolved request into success', async () => {
    await expect(withSaveTimeout(new Promise(() => {}), 'work order save', 5))
      .rejects.toBeInstanceOf(SaveConfirmationTimeoutError);
  });

  it('requires the persisted values to match before success', () => {
    const expected = {
      job_id: 'job-1', unit_number: 'M-141', unit_size: 'Studio', job_category_id: 'cat-1',
      has_extra_charges: true, extra_charges_line_items: [{ id: 'charge-1' }], sprinkler_form_left_in_unit: true,
    };
    expect(workOrderSaveMatches({ id: 'wo-1', ...expected }, expected)).toBe(true);
    expect(workOrderSaveMatches({ id: 'wo-1', ...expected, has_extra_charges: false }, expected)).toBe(false);
  });

  it('treats reordered JSONB object keys as the same persisted value', () => {
    const expected = {
      job_id: 'job-1',
      extra_charges_line_items: [{
        id: 'charge-1', categoryId: 'category-1', detailName: 'Accent Wall',
        quantity: 1, calculatedBillAmount: 200,
      }],
    };
    const saved = {
      id: 'wo-1', job_id: 'job-1',
      extra_charges_line_items: [{
        quantity: 1, id: 'charge-1', calculatedBillAmount: 200,
        detailName: 'Accent Wall', categoryId: 'category-1',
      }],
    };

    expect(workOrderSaveMatches(saved, expected)).toBe(true);
    expect(getWorkOrderSaveMismatches(saved, expected)).toEqual([]);
  });

  it('normalizes omitted object properties and undefined array values like JSON persistence', () => {
    const expected = {
      job_id: 'job-1',
      additional_services: { selected: true, unused: undefined },
      misc_additional_cost_items: [undefined, { id: 'misc-1', description: 'Patch' }],
      optional_note: null,
    };
    const saved = {
      job_id: 'job-1',
      additional_services: { selected: true },
      misc_additional_cost_items: [null, { description: 'Patch', id: 'misc-1' }],
    };

    expect(workOrderSaveMatches(saved, expected)).toBe(true);
  });

  it('reports genuinely different fields', () => {
    const expected = {
      job_id: 'job-1',
      sprinkler_form_left_in_unit: true,
      extra_charges_line_items: [{ id: 'charge-1', quantity: 1 }],
    };
    const saved = {
      job_id: 'job-1',
      sprinkler_form_left_in_unit: false,
      extra_charges_line_items: [{ quantity: 2, id: 'charge-1' }],
    };

    expect(getWorkOrderSaveMismatches(saved, expected)).toEqual([
      'sprinkler_form_left_in_unit',
      'extra_charges_line_items',
    ]);
  });
});
