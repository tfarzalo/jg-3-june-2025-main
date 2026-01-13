/*
  # Add Recurring Events Support

  1. Changes
    - Add recurring event fields to calendar_events table
    - Add indexes for better performance
    - Add check constraints for data validation

  2. Recurring Event Fields
    - is_recurring: boolean flag
    - recurrence_type: 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
    - recurrence_interval: number (e.g., 2 for bi-weekly, 3 for quarterly)
    - recurrence_days: array of weekdays for weekly recurrence
    - recurrence_end_date: optional end date for recurring events
    - parent_event_id: reference to original event for recurring instances
    - recurrence_rule: RRULE string for complex recurrence patterns
*/

-- Add recurring event columns to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN is_recurring boolean DEFAULT false,
ADD COLUMN recurrence_type text CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
ADD COLUMN recurrence_interval integer DEFAULT 1 CHECK (recurrence_interval > 0),
ADD COLUMN recurrence_days integer[] DEFAULT '{}' CHECK (array_length(recurrence_days, 1) IS NULL OR array_length(recurrence_days, 1) <= 7),
ADD COLUMN recurrence_end_date timestamptz,
ADD COLUMN parent_event_id uuid REFERENCES calendar_events(id) ON DELETE CASCADE,
ADD COLUMN recurrence_rule text;

-- Add indexes for better performance
CREATE INDEX idx_calendar_events_is_recurring ON calendar_events(is_recurring);
CREATE INDEX idx_calendar_events_parent_event_id ON calendar_events(parent_event_id);
CREATE INDEX idx_calendar_events_recurrence_type ON calendar_events(recurrence_type);

-- Add comments for documentation
COMMENT ON COLUMN calendar_events.is_recurring IS 'Whether this event is part of a recurring series';
COMMENT ON COLUMN calendar_events.recurrence_type IS 'Type of recurrence: daily, weekly, monthly, quarterly, yearly';
COMMENT ON COLUMN calendar_events.recurrence_interval IS 'Interval between recurrences (e.g., 2 for bi-weekly)';
COMMENT ON COLUMN calendar_events.recurrence_days IS 'Array of weekday numbers (0=Sunday, 1=Monday, etc.) for weekly recurrence';
COMMENT ON COLUMN calendar_events.recurrence_end_date IS 'Optional end date for the recurring series';
COMMENT ON COLUMN calendar_events.parent_event_id IS 'Reference to the original event in a recurring series';
COMMENT ON COLUMN calendar_events.recurrence_rule IS 'RRULE string for complex recurrence patterns (RFC 5545)';

-- Add constraint to ensure recurrence fields are only set for recurring events
ALTER TABLE calendar_events 
ADD CONSTRAINT check_recurring_fields 
CHECK (
  (is_recurring = false AND recurrence_type IS NULL AND recurrence_interval = 1 AND recurrence_days = '{}' AND recurrence_end_date IS NULL AND parent_event_id IS NULL) OR
  (is_recurring = true AND recurrence_type IS NOT NULL)
);

-- Add constraint to ensure recurrence_days only contains valid weekday numbers
-- Note: We'll validate this in the application layer since PostgreSQL doesn't allow
-- complex subqueries in check constraints
ALTER TABLE calendar_events 
ADD CONSTRAINT check_recurrence_days 
CHECK (
  array_length(recurrence_days, 1) IS NULL OR 
  (array_length(recurrence_days, 1) > 0 AND array_length(recurrence_days, 1) <= 7)
);
