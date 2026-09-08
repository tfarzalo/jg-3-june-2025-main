import { addDays } from 'date-fns';

/**
 * Business-day helpers for the subcontractor dashboard's 2-day schedule
 * visibility window.
 *
 * Rules:
 * - Subcontractors never work weekends, so Saturday/Sunday are never valid
 *   "visible" days.
 * - On a normal weekday (Mon-Thu), the visible window is "Today" + "Tomorrow".
 * - On a Friday, "tomorrow" is skipped forward to the following Monday
 *   (Today = Friday, Next = Monday).
 * - On a Saturday or Sunday, both visible days are skipped forward to the
 *   next two business days (Monday + Tuesday).
 */

function isWeekend(date: Date): boolean {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

/** Walks forward from `date` (not including a check of `date` itself unless `inclusive`) to find the next business day. */
function nextBusinessDay(date: Date, inclusive = false): Date {
  let candidate = inclusive ? new Date(date) : addDays(date, 1);
  while (isWeekend(candidate)) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

export interface SubcontractorVisibleDates {
  /** The date shown under the "Today" button. */
  primaryDate: Date;
  /** The date shown under the "Next business day" button. */
  secondaryDate: Date;
  /** True if today's actual calendar date is a Saturday/Sunday. */
  isReferenceWeekend: boolean;
}

/**
 * Computes the two dates a subcontractor is allowed to view jobs for,
 * given a reference date (defaults to "now").
 *
 * - Mon-Thu: { primary: today, secondary: tomorrow }
 * - Fri:     { primary: today (Fri), secondary: next Monday }
 * - Sat/Sun: { primary: next Monday, secondary: next Tuesday }
 */
export function getSubcontractorVisibleDates(
  referenceDate: Date = new Date()
): SubcontractorVisibleDates {
  const isReferenceWeekend = isWeekend(referenceDate);

  // primaryDate = the first business day on/after referenceDate
  const primaryDate = isReferenceWeekend
    ? nextBusinessDay(referenceDate, false)
    : new Date(referenceDate);

  // secondaryDate = the next business day strictly after primaryDate
  const secondaryDate = nextBusinessDay(primaryDate, false);

  return { primaryDate, secondaryDate, isReferenceWeekend };
}
