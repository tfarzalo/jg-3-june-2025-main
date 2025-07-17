import { format, parseISO, formatInTimeZone } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';

const TIMEZONE = 'America/New_York';

export const formatDate = (dateString: string): string => 
  formatInTimeZone(parseISO(dateString), TIMEZONE, 'MMM d, yyyy');

export const formatDateTime = (dateString: string): string => 
  formatInTimeZone(parseISO(dateString), TIMEZONE, 'MMM d, yyyy h:mm a');

export const getTodayRange = () => {
  const now = new Date();
  const easternDate = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const startDate = startOfDay(parseISO(easternDate));
  const endDate = endOfDay(parseISO(easternDate));
  
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  };
};

export const toISODateString = (date: Date): string => 
  formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");

export const getCurrentDateInEastern = (): string => 
  formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');