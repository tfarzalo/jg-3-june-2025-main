import { addDays, addWeeks, addMonths, addYears, isBefore, isAfter, isSameDay } from 'date-fns';
import { formatInTimeZone as tzFormat } from 'date-fns-tz';
import type { CalendarEvent } from '../types/calendar';

/**
 * Generate recurring event instances based on recurrence rules
 */
export function generateRecurringEvents(
  baseEvent: CalendarEvent,
  startDate: Date,
  endDate: Date
): CalendarEvent[] {
  if (!baseEvent.is_recurring || !baseEvent.recurrence_type) {
    return [baseEvent];
  }

  const events: CalendarEvent[] = [];
  const baseStart = new Date(baseEvent.start_at);
  const baseEnd = new Date(baseEvent.end_at);
  const duration = baseEnd.getTime() - baseStart.getTime();

  // Calculate the next occurrence date
  let currentDate = new Date(baseStart);
  const maxDate = baseEvent.recurrence_end_date ? new Date(baseEvent.recurrence_end_date) : endDate;
  const limitDate = isBefore(maxDate, endDate) ? maxDate : endDate;

  // Generate events up to the limit date
  while (isBefore(currentDate, limitDate)) {
    // Check if current date falls within our range
    if (isAfter(currentDate, startDate) || isSameDay(currentDate, startDate)) {
      const eventStart = new Date(currentDate);
      const eventEnd = new Date(eventStart.getTime() + duration);

      // For weekly recurrence, check if the day of week matches
      if (baseEvent.recurrence_type === 'weekly' && baseEvent.recurrence_days?.length) {
        const dayOfWeek = eventStart.getDay();
        if (!baseEvent.recurrence_days.includes(dayOfWeek)) {
          // Skip this occurrence if it doesn't match the selected days
          currentDate = getNextRecurrenceDate(currentDate, baseEvent);
          continue;
        }
      }

      // Create the recurring event instance
      const recurringEvent: CalendarEvent = {
        ...baseEvent,
        id: `${baseEvent.id}_${eventStart.toISOString().split('T')[0]}`, // Unique ID for each instance
        start_at: eventStart.toISOString(),
        end_at: eventEnd.toISOString(),
        parent_event_id: baseEvent.id,
      };

      events.push(recurringEvent);
    }

    // Move to next occurrence
    currentDate = getNextRecurrenceDate(currentDate, baseEvent);
  }

  return events;
}

/**
 * Calculate the next recurrence date based on the recurrence rules
 */
function getNextRecurrenceDate(currentDate: Date, event: CalendarEvent): Date {
  const interval = event.recurrence_interval || 1;

  switch (event.recurrence_type) {
    case 'daily':
      return addDays(currentDate, interval);
    case 'weekly':
      return addWeeks(currentDate, interval);
    case 'monthly':
      return addMonths(currentDate, interval);
    case 'quarterly':
      return addMonths(currentDate, interval * 3);
    case 'yearly':
      return addYears(currentDate, interval);
    default:
      return addDays(currentDate, 1);
  }
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

/**
 * Get recurring events for a specific day
 */
export function getRecurringEventsForDay(
  events: CalendarEvent[],
  targetDate: Date,
  timezone: string = 'America/New_York'
): CalendarEvent[] {
  const targetDateStr = tzFormat(targetDate, timezone, 'yyyy-MM-dd');
  const recurringEvents: CalendarEvent[] = [];

  // Group events by parent_event_id to avoid duplicates
  const parentEvents = new Map<string, CalendarEvent>();
  const recurringInstances = new Map<string, CalendarEvent[]>();

  events.forEach(event => {
    if (event.is_recurring && !event.parent_event_id) {
      // This is a parent recurring event
      parentEvents.set(event.id, event);
    } else if (event.parent_event_id) {
      // This is a recurring instance
      if (!recurringInstances.has(event.parent_event_id)) {
        recurringInstances.set(event.parent_event_id, []);
      }
      recurringInstances.get(event.parent_event_id)!.push(event);
    }
  });

  // Generate recurring events for each parent event
  parentEvents.forEach((parentEvent, parentId) => {
    // Generate events for a wider range to ensure we catch yearly events
    const rangeStart = new Date(targetDate);
    rangeStart.setDate(rangeStart.getDate() - 365); // Look back 1 year for yearly events
    const rangeEnd = new Date(targetDate);
    rangeEnd.setDate(rangeEnd.getDate() + 365); // Look forward 1 year for yearly events
    
    const generatedEvents = generateRecurringEvents(parentEvent, rangeStart, rangeEnd);
    
    // Debug logging for yearly events
    if (parentEvent.recurrence_type === 'yearly') {
      console.log('Yearly event debug:', {
        parentEvent: parentEvent.title,
        targetDate: targetDateStr,
        rangeStart: rangeStart.toISOString().split('T')[0],
        rangeEnd: rangeEnd.toISOString().split('T')[0],
        generatedCount: generatedEvents.length,
        generatedDates: generatedEvents.map(e => e.start_at.split('T')[0])
      });
    }
    
    // Filter for the target date
    const dayEvents = generatedEvents.filter(event => {
      const eventDate = tzFormat(new Date(event.start_at), timezone, 'yyyy-MM-dd');
      return eventDate === targetDateStr;
    });

    recurringEvents.push(...dayEvents);
  });

  // Add any existing instances for the target date
  const existingInstances = events.filter(event => {
    if (!event.parent_event_id) return false;
    const eventDate = tzFormat(new Date(event.start_at), timezone, 'yyyy-MM-dd');
    return eventDate === targetDateStr;
  });

  recurringEvents.push(...existingInstances);

  return recurringEvents;
}

/**
 * Create RRULE string for complex recurrence patterns
 */
export function createRRULE(event: CalendarEvent): string {
  if (!event.is_recurring || !event.recurrence_type) {
    return '';
  }

  const interval = event.recurrence_interval || 1;
  let rrule = `FREQ=${event.recurrence_type.toUpperCase()}`;
  
  if (interval > 1) {
    rrule += `;INTERVAL=${interval}`;
  }

  if (event.recurrence_days?.length && event.recurrence_type === 'weekly') {
    rrule += `;BYDAY=${event.recurrence_days.map(day => 
      ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][day]
    ).join(',')}`;
  }

  if (event.recurrence_end_date) {
    const endDate = new Date(event.recurrence_end_date);
    rrule += `;UNTIL=${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  }

  return rrule;
}
