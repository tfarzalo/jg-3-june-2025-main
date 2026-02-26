/**
 * Deadline Calculation Utilities
 * 
 * Helper functions for calculating and formatting assignment deadlines.
 * All deadlines are 3:30 PM Eastern Time on the day assigned (or next business day if assigned after 3:30 PM).
 */

/**
 * Calculate assignment deadline: 3:30 PM ET on the day assigned
 * If assigned after 3:30 PM ET, deadline is next business day at 3:30 PM ET
 */
export const calculateAssignmentDeadline = (assignedAt: Date): Date => {
  // Convert to Eastern Time
  const etString = assignedAt.toLocaleString('en-US', { 
    timeZone: 'America/New_York' 
  });
  const assignedET = new Date(etString);
  
  // Set deadline to 3:30 PM ET on the assigned date
  const deadlineET = new Date(assignedET);
  deadlineET.setHours(15, 30, 0, 0); // 3:30 PM
  
  // Check if assigned time is already past 3:30 PM ET
  if (assignedET >= deadlineET) {
    // Move to next business day
    deadlineET.setDate(deadlineET.getDate() + 1);
    
    // Skip weekend
    const dayOfWeek = deadlineET.getDay();
    if (dayOfWeek === 6) { // Saturday
      deadlineET.setDate(deadlineET.getDate() + 2); // Move to Monday
    } else if (dayOfWeek === 0) { // Sunday
      deadlineET.setDate(deadlineET.getDate() + 1); // Move to Monday
    }
  } else {
    // Check if today is weekend
    const dayOfWeek = deadlineET.getDay();
    if (dayOfWeek === 6) { // Saturday
      deadlineET.setDate(deadlineET.getDate() + 2); // Move to Monday
    } else if (dayOfWeek === 0) { // Sunday
      deadlineET.setDate(deadlineET.getDate() + 1); // Move to Monday
    }
  }
  
  return deadlineET;
};

/**
 * Get time remaining until deadline in milliseconds
 */
export const getTimeRemaining = (deadline: string | Date): number => {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  return deadlineDate.getTime() - now.getTime();
};

/**
 * Format time remaining as human-readable string
 */
export const formatTimeRemaining = (milliseconds: number): {
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  displayString: string;
  displayStringShort: string;
  color: 'green' | 'yellow' | 'orange' | 'red' | 'expired';
} => {
  if (milliseconds <= 0) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      displayString: 'EXPIRED',
      displayStringShort: 'EXPIRED',
      color: 'expired'
    };
  }
  
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
  
  const displayString = `${hours}h ${minutes}m ${seconds}s`;
  const displayStringShort = hours > 0 
    ? `${hours}h ${minutes}m`
    : `${minutes}m ${seconds}s`;
  
  // Determine color based on time remaining
  let color: 'green' | 'yellow' | 'orange' | 'red' | 'expired' = 'green';
  const totalHours = milliseconds / (1000 * 60 * 60);
  
  if (totalHours < 0.5) { // Less than 30 minutes
    color = 'red';
  } else if (totalHours < 1) { // Less than 1 hour
    color = 'orange';
  } else if (totalHours < 2) { // Less than 2 hours
    color = 'yellow';
  }
  
  return {
    hours,
    minutes,
    seconds,
    isExpired: false,
    displayString,
    displayStringShort,
    color
  };
};

/**
 * Get color classes for Tailwind based on time remaining
 */
export const getColorClasses = (color: 'green' | 'yellow' | 'orange' | 'red' | 'expired'): {
  bg: string;
  text: string;
  border: string;
} => {
  const colorMap = {
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800'
    },
    yellow: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-800'
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-700 dark:text-orange-400',
      border: 'border-orange-200 dark:border-orange-800'
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800'
    },
    expired: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-300 dark:border-gray-700'
    }
  };
  
  return colorMap[color];
};

/**
 * Format deadline as human-readable string
 */
export const formatDeadline = (deadline: string | Date, includeTime: boolean = true): string => {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  
  // Format in Eastern Time
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime && {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  };
  
  return deadlineDate.toLocaleString('en-US', options);
};

/**
 * Check if deadline is approaching (less than 1 hour remaining)
 */
export const isDeadlineApproaching = (deadline: string | Date): boolean => {
  const remaining = getTimeRemaining(deadline);
  return remaining > 0 && remaining < 3600000; // 1 hour in milliseconds
};

/**
 * Check if deadline is urgent (less than 30 minutes remaining)
 */
export const isDeadlineUrgent = (deadline: string | Date): boolean => {
  const remaining = getTimeRemaining(deadline);
  return remaining > 0 && remaining < 1800000; // 30 minutes in milliseconds
};

/**
 * Check if deadline has expired
 */
export const isDeadlineExpired = (deadline: string | Date): boolean => {
  return getTimeRemaining(deadline) <= 0;
};
