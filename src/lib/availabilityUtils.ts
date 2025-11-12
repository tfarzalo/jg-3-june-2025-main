/**
 * Utility functions for checking subcontractor availability based on working days
 */

export interface WorkingDays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

/**
 * Check if a subcontractor is available on a specific date
 * @param workingDays - The subcontractor's working days configuration
 * @param date - The date to check availability for
 * @returns boolean indicating if the subcontractor is available
 */
export function isAvailableOnDate(workingDays: WorkingDays | null, date: Date): boolean {
  if (!workingDays) {
    // Default to available if no working days specified
    return true;
  }

  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  switch (dayOfWeek) {
    case 0: // Sunday
      return workingDays.sunday;
    case 1: // Monday
      return workingDays.monday;
    case 2: // Tuesday
      return workingDays.tuesday;
    case 3: // Wednesday
      return workingDays.wednesday;
    case 4: // Thursday
      return workingDays.thursday;
    case 5: // Friday
      return workingDays.friday;
    case 6: // Saturday
      return workingDays.saturday;
    default:
      return false;
  }
}

/**
 * Check if a subcontractor is available today
 * @param workingDays - The subcontractor's working days configuration
 * @returns boolean indicating if the subcontractor is available today
 */
export function isAvailableToday(workingDays: WorkingDays | null): boolean {
  return isAvailableOnDate(workingDays, new Date());
}

/**
 * Get the day name from a date
 * @param date - The date to get the day name for
 * @returns The day name (e.g., "monday", "tuesday")
 */
export function getDayName(date: Date): keyof WorkingDays {
  const dayOfWeek = date.getDay();
  
  switch (dayOfWeek) {
    case 0: return 'sunday';
    case 1: return 'monday';
    case 2: return 'tuesday';
    case 3: return 'wednesday';
    case 4: return 'thursday';
    case 5: return 'friday';
    case 6: return 'saturday';
    default: throw new Error('Invalid day of week');
  }
}

/**
 * Get the next available working day for a subcontractor
 * @param workingDays - The subcontractor's working days configuration
 * @param startDate - The date to start looking from (defaults to today)
 * @returns The next available working date, or null if no working days are set
 */
export function getNextAvailableDay(workingDays: WorkingDays | null, startDate: Date = new Date()): Date | null {
  if (!workingDays) {
    return null;
  }

  // Check if any days are marked as working
  const hasWorkingDays = Object.values(workingDays).some(day => day);
  if (!hasWorkingDays) {
    return null;
  }

  let currentDate = new Date(startDate);
  let attempts = 0;
  const maxAttempts = 7; // Prevent infinite loops

  while (attempts < maxAttempts) {
    if (isAvailableOnDate(workingDays, currentDate)) {
      return currentDate;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
    attempts++;
  }

  return null;
}

/**
 * Get all available working days for a subcontractor
 * @param workingDays - The subcontractor's working days configuration
 * @returns Array of day names that are marked as working
 */
export function getAvailableWorkingDays(workingDays: WorkingDays | null): string[] {
  if (!workingDays) {
    return [];
  }

  return Object.entries(workingDays)
    .filter(([_, isWorking]) => isWorking)
    .map(([day, _]) => day);
}

/**
 * Get the count of working days per week
 * @param workingDays - The subcontractor's working days configuration
 * @returns Number of working days per week
 */
export function getWorkingDaysCount(workingDays: WorkingDays | null): number {
  if (!workingDays) {
    return 0;
  }

  return Object.values(workingDays).filter(day => day).length;
}

/**
 * Check if a subcontractor works on weekends
 * @param workingDays - The subcontractor's working days configuration
 * @returns boolean indicating if the subcontractor works on weekends
 */
export function worksOnWeekends(workingDays: WorkingDays | null): boolean {
  if (!workingDays) {
    return false;
  }

  return workingDays.saturday || workingDays.sunday;
}

/**
 * Check if a subcontractor works on weekdays only
 * @param workingDays - The subcontractor's working days configuration
 * @returns boolean indicating if the subcontractor works only on weekdays
 */
export function worksOnWeekdaysOnly(workingDays: WorkingDays | null): boolean {
  if (!workingDays) {
    return false;
  }

  return workingDays.monday && 
         workingDays.tuesday && 
         workingDays.wednesday && 
         workingDays.thursday && 
         workingDays.friday && 
         !workingDays.saturday && 
         !workingDays.sunday;
}
