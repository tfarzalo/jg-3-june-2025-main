/**
 * Timezone utility functions for consistent ET (America/New_York) formatting
 */

/**
 * Format a timestamp in ET timezone with full date and time
 * Example: "Tue, Feb 10, 2026 at 3:41 PM ET"
 */
export function formatDateTimeET(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return 'N/A';
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isNaN(date.getTime())) return 'Invalid date';
  
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date) + ' ET';
}

/**
 * Format a timestamp in ET timezone with short date
 * Example: "Feb 10, 2026 at 3:41 PM ET"
 */
export function formatShortDateTimeET(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return 'N/A';
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isNaN(date.getTime())) return 'Invalid date';
  
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date) + ' ET';
}

/**
 * Format a timestamp in ET timezone with date only
 * Example: "Tue, Feb 10, 2026"
 */
export function formatDateET(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return 'N/A';
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isNaN(date.getTime())) return 'Invalid date';
  
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Format a timestamp in ET timezone with time only
 * Example: "3:41 PM ET"
 */
export function formatTimeET(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return 'N/A';
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isNaN(date.getTime())) return 'Invalid date';
  
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date) + ' ET';
}
