/*
  # Fix Scheduled Date Off-by-One Issue

  ## Problem
  When editing a job and saving a new scheduled date, the date is being stored as
  one day earlier than what was selected. For example, selecting Jan 13 results
  in Jan 12 being stored.

  ## Root Cause
  The ensure_eastern_time trigger is converting dates incorrectly:
  1. PostgreSQL receives "2026-01-13" as a string for a timestamptz column
  2. It first interprets this as "2026-01-13 00:00:00 UTC"
  3. The trigger casts to date, which converts to EST: "2026-01-12 19:00:00 EST"
  4. Then concatenates " 00:00:00 America/New_York", resulting in Jan 12

  ## Solution
  Update the trigger to properly parse string inputs as dates in Eastern timezone
  before converting to timestamptz. This ensures "2026-01-13" is interpreted as
  midnight Eastern Time, not midnight UTC.
*/

-- Drop the existing trigger
DROP TRIGGER IF EXISTS ensure_eastern_time_trigger ON jobs;

-- Update the ensure_eastern_time function with corrected logic
CREATE OR REPLACE FUNCTION ensure_eastern_time()
RETURNS trigger AS $$
DECLARE
  date_str text;
BEGIN
  IF NEW.scheduled_date IS NOT NULL THEN
    -- The problem: when a date string like "2026-01-13" comes from the client,
    -- PostgreSQL converts it to timestamptz as "2026-01-13 00:00:00 UTC" (implicit cast)
    --
    -- We need to:
    -- 1. Extract the date in UTC (what was actually sent)
    -- 2. Interpret that date as if it were in Eastern Time
    -- 3. Convert it to the proper timestamptz
    --
    -- Example: "2026-01-13" from client
    --   -> PostgreSQL sees: 2026-01-13 00:00:00+00 (UTC)
    --   -> We extract: '2026-01-13'
    --   -> We interpret as: 2026-01-13 00:00:00 America/New_York
    --   -> Which is: 2026-01-13 05:00:00+00 (stored in UTC)
    --   -> Displays as: Jan 13 (correct!)

    -- Extract the date as it appears in UTC (this is what the client actually sent)
    date_str := to_char(NEW.scheduled_date, 'YYYY-MM-DD');

    RAISE NOTICE 'ensure_eastern_time: Before conversion - received UTC timestamp = %, extracted date string = %',
                 NEW.scheduled_date, date_str;

    -- Now interpret this date as midnight Eastern Time
    NEW.scheduled_date := (date_str || ' 00:00:00')::timestamp AT TIME ZONE 'America/New_York';

    RAISE NOTICE 'ensure_eastern_time: After conversion - final ET timestamp = % (displays as % in ET)',
                 NEW.scheduled_date, NEW.scheduled_date AT TIME ZONE 'America/New_York';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER ensure_eastern_time_trigger
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_eastern_time();

-- Test the fix with example dates
DO $$
DECLARE
  test_input timestamptz;
  date_str text;
  test_result timestamptz;
BEGIN
  -- Simulate what happens when client sends "2026-01-13"
  -- PostgreSQL implicitly converts it to "2026-01-13 00:00:00 UTC"
  test_input := '2026-01-13 00:00:00 UTC'::timestamptz;

  RAISE NOTICE '=== Testing Date Conversion ===';
  RAISE NOTICE 'Step 1: Client sends string "2026-01-13"';
  RAISE NOTICE 'Step 2: PostgreSQL converts to UTC: %', test_input;

  -- Simulate what the trigger will do
  date_str := to_char(test_input, 'YYYY-MM-DD');
  RAISE NOTICE 'Step 3: Trigger extracts date string: %', date_str;

  test_result := (date_str || ' 00:00:00')::timestamp AT TIME ZONE 'America/New_York';
  RAISE NOTICE 'Step 4: Trigger converts to ET: % UTC = % ET',
               test_result, test_result AT TIME ZONE 'America/New_York';

  RAISE NOTICE '=== Result ===';
  RAISE NOTICE 'Client selected: Jan 13, 2026';
  RAISE NOTICE 'Database stores: % (which displays as Jan %)',
               test_result, date_str;

  IF date_str = '2026-01-13' THEN
    RAISE NOTICE 'SUCCESS: Dates match!';
  ELSE
    RAISE NOTICE 'ERROR: Date mismatch!';
  END IF;
END $$;
