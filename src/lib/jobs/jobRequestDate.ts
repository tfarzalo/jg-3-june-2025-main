import { getCurrentDateInEastern } from '../dateUtils';

/** Use the calendar's date-only value without converting it to a local timezone. */
export function getInitialJobRequestDate(search: string): string {
  const date = new URLSearchParams(search).get('scheduled_date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date) {
      return date;
    }
  }
  return getCurrentDateInEastern();
}
