import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertJobPropertyEligible, fetchJobEligibleProperties } from '../src/lib/properties/jobEligibility';

const { db } = vi.hoisted(() => ({ db: { from: vi.fn() } }));
vi.mock('../src/utils/supabase', () => ({ supabase: db }));

let records: Array<{ id: string; property_name: string; is_active: boolean; is_archived: boolean }>;
let queryError: unknown;

beforeEach(() => {
  records = [
    { id: 'active', property_name: 'Active', is_active: true, is_archived: false },
    { id: 'inactive', property_name: 'Inactive', is_active: false, is_archived: false },
    { id: 'archived', property_name: 'Archived', is_active: true, is_archived: true },
  ];
  queryError = null;
  db.from.mockReset().mockImplementation(() => {
    const filters: Array<[string, unknown]> = [];
    const matching = () => records.filter(row => filters.every(([key, value]) => row[key as keyof typeof row] === value));
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key, value) => { filters.push([key, value]); return query; }),
      order: vi.fn(async () => ({ data: matching(), error: queryError })),
      maybeSingle: vi.fn(async () => ({ data: matching()[0] || null, error: queryError })),
    };
    return query;
  });
});

describe('property eligibility for jobs', () => {
  it('only lists active, unarchived properties for full selectors and import lookup', async () => {
    for (const select of ['*', 'id, property_name']) {
      const result = await fetchJobEligibleProperties(select);
      expect(result.data?.map(row => row.id)).toEqual(['active']);
    }
  });

  it('reflects deactivation and reactivation when choices reload', async () => {
    records[0].is_active = false;
    expect((await fetchJobEligibleProperties()).data).toEqual([]);
    records[1].is_active = true;
    expect((await fetchJobEligibleProperties()).data?.map(row => row.id)).toEqual(['inactive']);
  });

  it('accepts an active property and rejects a stale selection after deactivation', async () => {
    await expect(assertJobPropertyEligible('active')).resolves.toBeUndefined();
    records[0].is_active = false;
    await expect(assertJobPropertyEligible('active')).rejects.toThrow('inactive');
  });

  it.each(['inactive', 'archived', 'missing', ''])('rejects unavailable new selections: %s', async id => {
    await expect(assertJobPropertyEligible(id)).rejects.toThrow();
  });

  it.each(['inactive', 'archived'])('preserves an existing job linked to %s', async id => {
    await expect(assertJobPropertyEligible(id, id)).resolves.toBeUndefined();
    expect(db.from).not.toHaveBeenCalled();
  });

  it('checks reassignment even when the original property is inactive', async () => {
    await expect(assertJobPropertyEligible('active', 'inactive')).resolves.toBeUndefined();
    await expect(assertJobPropertyEligible('archived', 'inactive')).rejects.toThrow();
  });

  it('blocks submission when property status cannot be verified', async () => {
    queryError = { message: 'Network failure' };
    await expect(assertJobPropertyEligible('active')).rejects.toThrow('Unable to verify');
  });
});
