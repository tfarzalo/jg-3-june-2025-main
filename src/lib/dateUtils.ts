import { parseISO } from 'date-fns';
import { formatInTimeZone, utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';

// Use Eastern Time as the application's default timezone
const TIMEZONE = 'America/New_York';

/**
 * Format a date string to a readable date format
 * For date-only strings (YYYY-MM-DD), formats without timezone conversion
 * to avoid off-by-one day errors
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) {
    return '—';
  }
  
  try {
    console.log('formatDate: Input:', dateString);
    
    // Check if this is a pure date string (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Parse the date string directly without creating Date object
      // to avoid ANY timezone conversion
      const [year, month, day] = dateString.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formatted = `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
      console.log('formatDate: Pure string manipulation (no Date object):', formatted);
      return formatted;
    }
    
    // If it has a time component, use timezone conversion
    const formatted = formatInTimeZone(
      parseISO(dateString),
      TIMEZONE,
      'MMM d, yyyy'
    );
    console.log('formatDate: With timezone conversion:', formatted);
    return formatted;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '—';
  }
}

/**
 * Format a date string to a readable date and time format
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return '—';
  }
  
  try {
    return formatInTimeZone(
      parseISO(dateString),
      TIMEZONE,
      'MMM d, yyyy h:mm a'
    );
  } catch (error) {
    console.error('Error formatting date time:', error);
    return '—';
  }
}

/**
 * Format a date string to a readable time format in Eastern Time
 */
export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return '—';
  }
  
  try {
    return formatInTimeZone(
      parseISO(dateString),
      TIMEZONE,
      'h:mm a'
    );
  } catch (error) {
    console.error('Error formatting time:', error);
    return '—';
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
 * This function handles dates as pure date strings without timezone conversion
 * to avoid off-by-one day issues.
 */
export function formatDateForInput(dateString: string | null | undefined): string {
  if (!dateString) {
    return '';
  }
  
  try {
    console.log('formatDateForInput: Input:', dateString);
    
    // If the string is already in YYYY-MM-DD format, return it as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      console.log('formatDateForInput: Already YYYY-MM-DD, returning as-is:', dateString);
      return dateString;
    }
    
    // If it's an ISO string with time, extract just the date part
    if (dateString.includes('T')) {
      const dateOnly = dateString.split('T')[0];
      console.log('formatDateForInput: Extracted from ISO:', dateOnly);
      return dateOnly;
    }
    
    // Fallback: parse and format (this may have timezone issues)
    console.log('formatDateForInput: Using fallback parse/format');
    const date = parseISO(dateString);
    const formatted = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
    console.log('formatDateForInput: Fallback result:', formatted);
    return formatted;
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return '';
  }
}

/**
 * Format a date for display in a consistent way
 */
export function formatDisplayDate(dateString: string | null | undefined): string {
  if (!dateString) {
    return '—';
  }
  
  try {
    // Check if this is a pure date string (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Parse the date string directly without creating Date object
      // to avoid ANY timezone conversion
      const [year, month, day] = dateString.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const formatted = `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
      console.log('formatDisplayDate: Pure string manipulation (no Date object):', formatted);
      return formatted;
    }

    const date = parseISO(dateString);
    return formatInTimeZone(date, TIMEZONE, 'MMMM d, yyyy');
  } catch (error) {
    console.error('Error formatting display date:', error);
    return '—';
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
    // Check if this is a pure date string (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Parse the date string directly without creating Date object
      // to avoid ANY timezone conversion
      const [year, month, day] = dateString.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const formatted = `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
      console.log('formatCalendarDate: Pure string manipulation (no Date object):', formatted);
      return formatted;
    }

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
    let date1Eastern: string;

    // Handle string input
    if (typeof date1 === 'string') {
      // If it's YYYY-MM-DD, use it directly to avoid timezone shifts
      if (/^\d{4}-\d{2}-\d{2}$/.test(date1)) {
        date1Eastern = date1;
      } else {
        // It has time component, convert to Eastern
        date1Eastern = formatInTimeZone(parseISO(date1), TIMEZONE, 'yyyy-MM-dd');
      }
    } else {
      // Date object, convert to Eastern
      date1Eastern = formatInTimeZone(date1, TIMEZONE, 'yyyy-MM-dd');
    }
      
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

/**
 * Normalize a date string for database storage
 * For DATE columns, we send just YYYY-MM-DD
 * PostgreSQL will store this as the specified date
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns YYYY-MM-DD string for database storage
 */
export function normalizeDateToEastern(dateString: string): string {
  if (!dateString) {
    return '';
  }
  
  try {
    // Validate format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      console.warn('Invalid date format, expected YYYY-MM-DD:', dateString);
      return dateString;
    }
    
    // For DATE columns in PostgreSQL, just return YYYY-MM-DD
    // The database will interpret this as a date without timezone issues
    console.log('normalizeDateToEastern: Input:', dateString, '-> Output:', dateString);
    return dateString;
  } catch (error) {
    console.error('Error normalizing date:', error);
    return dateString;
  }
}

/**
 * Create a Date object representing noon on a specific date in Eastern Time
 * Uses zonedTimeToUtc to properly handle timezone conversion including DST
 * Using noon avoids midnight timezone boundary issues
 * 
 * @param year - Year (e.g., 2026)
 * @param month - Month (0-11, where 0 = January)
 * @param day - Day of month (1-31)
 * @returns Date object representing noon on that calendar date in Eastern Time
 */
export function createEasternDate(year: number, month: number, day: number): Date {
  // Create date string for noon Eastern Time
  const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} 12:00:00`;
  
  // Convert to UTC - this properly handles DST
  return zonedTimeToUtc(dateString, TIMEZONE);
}

/**
 * Parse a YYYY-MM-DD date string as a Date object representing noon in Eastern Time
 * Use this when you need a Date object from a database DATE value
 * Using noon avoids midnight timezone boundary issues
 * 
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Date object representing noon on that calendar date in Eastern Time
 */
export function parseAsEasternDate(dateString: string): Date {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Invalid date format: ${dateString}, expected YYYY-MM-DD`);
  }
  
  // Parse as noon Eastern Time and convert to UTC
  // This ensures the Date object represents the correct calendar date
  return zonedTimeToUtc(`${dateString} 12:00:00`, TIMEZONE);
}