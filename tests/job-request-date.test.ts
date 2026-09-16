import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getInitialJobRequestDate } from '../src/lib/jobs/jobRequestDate';

beforeEach(() => {
  vi.useFakeTimers();
  // UTC is already the 12th while the application's Eastern date is still the 11th.
  vi.setSystemTime(new Date('2026-09-12T02:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('job request initial date', () => {
  it('defaults general new-job requests to today in Eastern time', () => {
    expect(getInitialJobRequestDate('')).toBe('2026-09-11');
  });

  it.each(['2026-09-10', '2026-09-11', '2026-10-20', '2024-02-29', '2026-03-08', '2026-11-01'])(
    'preserves the selected calendar date %s, including DST and leap days', date => {
      const search = `?scheduled_date=${encodeURIComponent(date)}`;
      expect(getInitialJobRequestDate(search)).toBe(date);
    }
  );

  it.each(['', 'invalid', '2026-02-29', '2026-04-31', '2026-13-10', '2026-09-00', '2026-9-10', '2026-09-10T00:00:00Z'])(
    'falls back to today for an invalid supplied date: %s', date => {
      expect(getInitialJobRequestDate(`?scheduled_date=${encodeURIComponent(date)}`)).toBe('2026-09-11');
    }
  );
});
