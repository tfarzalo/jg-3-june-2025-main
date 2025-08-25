import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';

// Use Eastern Time as the application's default timezone
const TIMEZONE = 'America/New_York';

/**
 * Format a date string to a readable date format
 */
export function formatDate(dateString: string): string {
  try {
    return formatInTimeZone(
      parseISO(dateString),
      TIMEZONE,
      'MMM d, yyyy'
    );
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

/**
 * Format a date string to a readable date and time format
 */
export function formatDateTime(dateString: string): string {
  try {
    return formatInTimeZone(
      parseISO(dateString),
      TIMEZONE,
      'MMM d, yyyy h:mm a'
    );
  } catch (error) {
    console.error('Error formatting date time:', error);
    return dateString;
  }
}

/**
 * Get the start and end of today in Eastern Time
 */
export function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  const easternDate = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const startDate = startOfDay(parseISO(easternDate));
  const endDate = endOfDay(parseISO(easternDate));
  
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  };
}

/**
 * Convert a date to ISO string format
 */
export function toISODateString(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Get the current date in Eastern Time
 */
export function getCurrentDateInEastern(): string {
  const now = new Date();
  return formatInTimeZone(now, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Convert a date string to a date object in Eastern Time
 */
export function parseEasternDate(dateString: string): Date {
  // If the date is already in ISO format with timezone, parse it directly
  if (dateString.includes('T')) {
    return parseISO(dateString);
  }
  
  // Otherwise, assume it's a date-only string (YYYY-MM-DD) and add Eastern timezone
  return parseISO(`${dateString}T00:00:00-04:00`);
}

/**
 * Format a date for form inputs (YYYY-MM-DD)
 */
export function formatDateForInput(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return dateString;
  }
}

/**
 * Format a date for display in a consistent way
 */
export function formatDisplayDate(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return formatInTimeZone(date, TIMEZONE, 'MMMM d, yyyy');
  } catch (error) {
    console.error('Error formatting display date:', error);
    return dateString;
  }
}

/**
 * Check if a date is today in Eastern Time
 */
export function isEasternToday(dateString: string): boolean {
  try {
    const date = parseISO(dateString);
    const today = new Date();
    
    const dateInEastern = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
    const todayInEastern = formatInTimeZone(today, TIMEZONE, 'yyyy-MM-dd');
    
    return dateInEastern === todayInEastern;
  } catch (error) {
    console.error('Error checking if date is today:', error);
    return false;
  }
}

/**
 * Get the Eastern Time date from a UTC date
 */
export function getEasternDate(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Format a date for calendar display
 */
export function formatCalendarDate(dateString: string): string {
  try {
    return formatInTimeZone(
      parseISO(dateString),
      TIMEZONE,
      'MMMM d, yyyy'
    );
  } catch (error) {
    console.error('Error formatting calendar date:', error);
    return dateString;
  }
}

/**
 * Compare two dates in Eastern Time (for calendar day matching)
 */
export function isSameDayInEastern(date1: string | Date, date2: Date): boolean {
  try {
    // Convert both dates to Eastern Time date strings (YYYY-MM-DD)
    const date1Eastern = typeof date1 === 'string' 
      ? formatInTimeZone(parseISO(date1), TIMEZONE, 'yyyy-MM-dd')
      : formatInTimeZone(date1, TIMEZONE, 'yyyy-MM-dd');
      
    const date2Eastern = formatInTimeZone(date2, TIMEZONE, 'yyyy-MM-dd');
    
    // Compare the date strings
    return date1Eastern === date2Eastern;
  } catch (error) {
    console.error('Error comparing dates:', error);
    return false;
  }
}

/**
 * Debug function to log date information
 */
export function debugDate(dateString: string, label = 'Date'): void {
  try {
    const date = parseISO(dateString);
    console.log(`${label}:`, {
      original: dateString,
      parsed: date.toISOString(),
      easternDate: formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd'),
      easternTime: formatInTimeZone(date, TIMEZONE, 'HH:mm:ss'),
      easternFull: formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd HH:mm:ss zzz')
    });
  } catch (error) {
    console.error(`Error debugging ${label}:`, error);
  }
}