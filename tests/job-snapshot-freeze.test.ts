import { describe, it, expect, vi } from 'vitest';
import { getAdditionalBillingLines } from '../src/lib/billing/additional';
import { isFrozenHistoricalSnapshot } from '../src/lib/jobs/historicalDataMode';

describe('job snapshot freeze behavior', () => {
  it('keeps an already completed snapshot-backed job on frozen billing data', async () => {
    const mockSupabase = {
      from: vi.fn(() => {
        throw new Error('live billing queries should not run for frozen jobs');
      }),
    };

    const frozenLines = [
      {
        key: 'painted_ceilings',
        label: 'Painted Ceilings (Unit)',
        qty: 1,
        unitLabel: '2 Bedroom',
        rateBill: 125,
        rateSub: 70,
        amountBill: 125,
        amountSub: 70,
      },
    ];

    const result = await getAdditionalBillingLines(mockSupabase as never, {
      frozen_billing_lines: frozenLines,
      painted_ceilings: true,
      ceiling_billing_detail_id: 'live-rate-that-should-not-be-read',
    });

    expect(isFrozenHistoricalSnapshot('Completed', 'snapshot')).toBe(true);
    expect(result.lines).toEqual(frozenLines);
    expect(result.warnings).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
