import { describe, expect, it } from 'vitest';
import { SaveConfirmationTimeoutError, withSaveTimeout, workOrderSaveMatches } from '../src/lib/workOrders/saveConfirmation';

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
});
