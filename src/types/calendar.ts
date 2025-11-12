export type CalendarEvent = {
  id: string;
  title: string;
  details?: string | null;
  color: string;                // hex or token
  is_all_day: boolean;
  start_at: string;             // ISO
  end_at: string;               // ISO (exclusive)
  created_by: string;
  created_at: string;
  updated_at: string;
  // Recurring event fields
  is_recurring?: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  recurrence_interval?: number;
  recurrence_days?: number[];   // Array of weekday numbers (0=Sunday, 1=Monday, etc.)
  recurrence_end_date?: string; // ISO
  parent_event_id?: string;
  recurrence_rule?: string;     // RRULE string
};

export type CalendarEventInsert = {
  title: string;
  details?: string | null;
  color?: string;
  is_all_day?: boolean;
  start_at: string;    // ISO
  end_at: string;      // ISO
  // Recurring event fields
  is_recurring?: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  recurrence_interval?: number;
  recurrence_days?: number[];
  recurrence_end_date?: string;
  parent_event_id?: string;
  recurrence_rule?: string;
};

export type RecurrenceOption = {
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  label: string;
  interval?: number;
  days?: number[];
};
