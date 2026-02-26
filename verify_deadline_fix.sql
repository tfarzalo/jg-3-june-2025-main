-- =====================================================
-- Verify Deadline Fix - All Should Show 15:30:00 (3:30 PM ET)
-- =====================================================

-- Test current time
SELECT 
  'RIGHT NOW' as scenario,
  NOW() as current_utc,
  (NOW() AT TIME ZONE 'America/New_York')::timestamp as current_et,
  calculate_assignment_deadline(NOW()) as deadline_utc,
  (calculate_assignment_deadline(NOW()) AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  EXTRACT(HOUR FROM (calculate_assignment_deadline(NOW()) AT TIME ZONE 'America/New_York')::timestamp) as deadline_hour,
  EXTRACT(MINUTE FROM (calculate_assignment_deadline(NOW()) AT TIME ZONE 'America/New_York')::timestamp) as deadline_minute;

-- Test various scenarios
SELECT 
  'Morning 9 AM ET' as scenario,
  (TIMESTAMP '2026-02-25 15:30:00' AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  EXTRACT(HOUR FROM (calculate_assignment_deadline(TIMESTAMP '2026-02-25 14:00:00+00') AT TIME ZONE 'America/New_York')::timestamp) as hour,
  EXTRACT(MINUTE FROM (calculate_assignment_deadline(TIMESTAMP '2026-02-25 14:00:00+00') AT TIME ZONE 'America/New_York')::timestamp) as minute
UNION ALL
SELECT 
  'Afternoon 3:15 PM ET' as scenario,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-25 20:15:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  EXTRACT(HOUR FROM (calculate_assignment_deadline(TIMESTAMP '2026-02-25 20:15:00+00') AT TIME ZONE 'America/New_York')::timestamp) as hour,
  EXTRACT(MINUTE FROM (calculate_assignment_deadline(TIMESTAMP '2026-02-25 20:15:00+00') AT TIME ZONE 'America/New_York')::timestamp) as minute
UNION ALL
SELECT 
  'Evening 4:00 PM ET' as scenario,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-25 21:00:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  EXTRACT(HOUR FROM (calculate_assignment_deadline(TIMESTAMP '2026-02-25 21:00:00+00') AT TIME ZONE 'America/New_York')::timestamp) as hour,
  EXTRACT(MINUTE FROM (calculate_assignment_deadline(TIMESTAMP '2026-02-25 21:00:00+00') AT TIME ZONE 'America/New_York')::timestamp) as minute;

-- Verification: ALL hours should be 15 (3 PM) and ALL minutes should be 30
SELECT 
  CASE 
    WHEN EXTRACT(HOUR FROM (calculate_assignment_deadline(NOW()) AT TIME ZONE 'America/New_York')::timestamp) = 15 
         AND EXTRACT(MINUTE FROM (calculate_assignment_deadline(NOW()) AT TIME ZONE 'America/New_York')::timestamp) = 30 
    THEN '✅ CORRECT: Deadline is 3:30 PM ET'
    ELSE '❌ WRONG: Deadline is NOT 3:30 PM ET'
  END as verification_result;
