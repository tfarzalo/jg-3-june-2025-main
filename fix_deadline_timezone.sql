-- =====================================================
-- Fix Assignment Deadline Calculation - Timezone Issue
-- =====================================================
-- This fixes the timezone conversion to ensure deadline is ALWAYS 3:30 PM ET

CREATE OR REPLACE FUNCTION calculate_assignment_deadline(p_assigned_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  v_assigned_et TIMESTAMP;
  v_deadline_et TIMESTAMP;
  v_day_of_week INT;
BEGIN
  -- Convert assigned timestamp to Eastern Time (without timezone)
  v_assigned_et := (p_assigned_at AT TIME ZONE 'America/New_York')::TIMESTAMP;
  
  -- Get the date portion in ET and set time to 3:30 PM (15:30)
  v_deadline_et := date_trunc('day', v_assigned_et) + INTERVAL '15 hours 30 minutes';
  
  -- Check if assigned time is already past 3:30 PM ET
  IF v_assigned_et >= v_deadline_et THEN
    -- Move deadline to next day at 3:30 PM ET
    v_deadline_et := v_deadline_et + INTERVAL '1 day';
    
    -- Get day of week (0 = Sunday, 6 = Saturday)
    v_day_of_week := EXTRACT(DOW FROM v_deadline_et);
    
    -- If next day is Saturday, move to Monday
    IF v_day_of_week = 6 THEN
      v_deadline_et := v_deadline_et + INTERVAL '2 days';
    -- If next day is Sunday, move to Monday  
    ELSIF v_day_of_week = 0 THEN
      v_deadline_et := v_deadline_et + INTERVAL '1 day';
    END IF;
  ELSE
    -- Deadline is today at 3:30 PM ET
    -- But check if today is weekend
    v_day_of_week := EXTRACT(DOW FROM v_deadline_et);
    
    -- If today is Saturday, move to Monday
    IF v_day_of_week = 6 THEN
      v_deadline_et := v_deadline_et + INTERVAL '2 days';
    -- If today is Sunday, move to Monday
    ELSIF v_day_of_week = 0 THEN
      v_deadline_et := v_deadline_et + INTERVAL '1 day';
    END IF;
  END IF;
  
  -- Convert the ET timestamp back to UTC with proper timezone handling
  -- This creates a timestamptz from the ET time, treating it as if it's in America/New_York
  RETURN timezone('America/New_York', v_deadline_et);
END;
$$;

-- Test the fix
SELECT 
  'Test 1: Assigned NOW' as test_case,
  calculate_assignment_deadline(NOW()) as deadline_utc,
  (calculate_assignment_deadline(NOW()) AT TIME ZONE 'America/New_York')::timestamp as deadline_et;

SELECT 
  'Test 2: Assigned at 9:00 AM ET' as test_case,
  calculate_assignment_deadline(TIMESTAMP '2026-02-25 14:00:00+00') as deadline_utc,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-25 14:00:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et;

SELECT 
  'Test 3: Assigned at 4:00 PM ET' as test_case,
  calculate_assignment_deadline(TIMESTAMP '2026-02-25 21:00:00+00') as deadline_utc,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-25 21:00:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et;

-- Success message
SELECT '✅ Deadline calculation function fixed! All deadlines will now be 3:30 PM ET.' as status;
