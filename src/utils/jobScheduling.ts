/**
 * Shared multi-day job scheduling utilities.
 *
 * Single source of truth for determining whether a job spans multiple days,
 * and for checking if a job is "active" on a given calendar day.
 *
 * Design principle: `scheduled_end_date` is OPTIONAL. When it is null/undefined
 * or equal to the scheduled_date's day, the job is treated exactly as it always
 * has been (a single-day job on scheduled_date) — guaranteeing zero behavior
 * change for all existing jobs and any code path that hasn't been updated yet.
 */

export interface JobScheduleLike {
  scheduled_date: string | null | undefined;
  scheduled_end_date?: string | null | undefined;
}

/**
 * Extracts just the YYYY-MM-DD portion from a date/timestamp string.
 * Handles both `date` values ("2026-01-23") and `timestamptz` values
 * ("2026-01-23T00:00:00-05:00").
 */
function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.split('T')[0];
}

/**
 * Returns true if the job has a real, distinct end date set (i.e. is
 * genuinely multi-day). Returns false for single-day jobs, including jobs
 * where scheduled_end_date happens to equal scheduled_date.
 */
export function isMultiDayJob(job: JobScheduleLike): boolean {
  const start = toDateOnly(job.scheduled_date);
  const end = toDateOnly(job.scheduled_end_date);
  if (!start || !end) return false;
  return end > start;
}

/**
 * Returns the effective end date (YYYY-MM-DD) for a job — either the real
 * scheduled_end_date, or scheduled_date itself if no span is set.
 */
export function getJobEndDate(job: JobScheduleLike): string | null {
  const start = toDateOnly(job.scheduled_date);
  const end = toDateOnly(job.scheduled_end_date);
  if (end && end >= (start ?? '')) return end;
  return start;
}

/**
 * Returns the start date (YYYY-MM-DD) for a job.
 */
export function getJobStartDate(job: JobScheduleLike): string | null {
  return toDateOnly(job.scheduled_date);
}

/**
 * Returns the number of days a job spans (inclusive). Single-day jobs = 1.
 */
export function getJobDurationDays(job: JobScheduleLike): number {
  const start = getJobStartDate(job);
  const end = getJobEndDate(job);
  if (!start || !end) return 1;

  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays + 1 : 1;
}

/**
 * Core spanning check: is the given date (Date object or YYYY-MM-DD string)
 * within the job's [scheduled_date, effective end date] range, inclusive?
 *
 * For single-day jobs, this is equivalent to the exact-match comparison
 * every surface in the app currently performs, so this function is a
 * drop-in, non-breaking replacement for those comparisons.
 */
export function isJobActiveOnDate(job: JobScheduleLike, date: Date | string): boolean {
  const start = getJobStartDate(job);
  if (!start) return false;
  const end = getJobEndDate(job) ?? start;

  const dateKey = typeof date === 'string' ? date.split('T')[0] : formatDateKeyLocal(date);

  return dateKey >= start && dateKey <= end;
}

/**
 * Formats a Date as a local YYYY-MM-DD key (no timezone conversion),
 * matching the convention used by existing calendar components.
 */
function formatDateKeyLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Which day-of-span a given date falls on for a job, e.g. "Day 2 of 3".
 * Returns null if the date is not within the job's range.
 */
export function getJobSpanDayLabel(job: JobScheduleLike, date: Date | string): string | null {
  const start = getJobStartDate(job);
  if (!start) return null;
  const end = getJobEndDate(job) ?? start;
  const totalDays = getJobDurationDays(job);
  if (totalDays <= 1) return null;

  const dateKey = typeof date === 'string' ? date.split('T')[0] : formatDateKeyLocal(date);
  if (dateKey < start || dateKey > end) return null;

  const startDate = new Date(`${start}T00:00:00Z`);
  const currentDate = new Date(`${dateKey}T00:00:00Z`);
  const dayNumber = Math.round((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return `Day ${dayNumber} of ${totalDays}`;
}

/**
 * Formats a human-readable date range for display, e.g.:
 *   Single-day: "Jan 23, 2026"
 *   Multi-day:  "Jan 23 – Jan 25, 2026"
 */
export function formatJobDateRange(
  job: JobScheduleLike,
  formatDate: (dateStr: string) => string
): string {
  const start = getJobStartDate(job);
  if (!start) return 'Not Scheduled';

  if (!isMultiDayJob(job)) {
    return formatDate(job.scheduled_date as string);
  }

  const end = getJobEndDate(job) as string;
  return `${formatDate(start)} – ${formatDate(end)}`;
}
