-- =====================================================
-- UPDATE DAILY AGENDA EMAIL CRON TO 5:00 AM ET
-- =====================================================
-- This script updates the cron job schedule to run at
-- 5:00 AM Eastern Time (ET) consistently
-- =====================================================

-- IMPORTANT: ET to UTC Conversion
-- - 5:00 AM ET during Standard Time = 10:00 UTC
-- - 5:00 AM ET during Daylight Saving = 9:00 UTC
-- 
-- We'll use 10:00 UTC as the standard time, which means:
-- - Nov-Mar (Standard Time): 5:00 AM ET ✓
-- - Mar-Nov (Daylight Saving): 6:00 AM EDT (1 hour later)
--
-- If you want true 5:00 AM year-round, you'd need to manually
-- adjust twice per year, or use 9:00 UTC (which would be
-- 4:00 AM EST / 5:00 AM EDT)

-- Option 1: Remove old job and create new one at 5:00 AM EST (10:00 UTC)
-- This keeps it at 5:00 AM during winter, 6:00 AM during summer

-- Step 1: Remove the old cron job
DO $$
BEGIN
  PERFORM cron.unschedule('daily-agenda-email-job');
  RAISE NOTICE 'Removed old cron job';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'No existing cron job to remove or already removed';
END $$;

-- Step 2: Create new cron job at 5:00 AM ET (10:00 UTC)
-- Schedule: '0 10 * * *' = 10:00 UTC = 5:00 AM EST / 6:00 AM EDT
SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 10 * * *',  -- 5:00 AM EST / 6:00 AM EDT
  $$
  SELECT 
    status,
    content::json->>'message' as result
  FROM 
    http((
      'POST',
      'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid3RmaW1uYm12Ymdlc2lkYnhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNDU4MzQ1NiwiZXhwIjoyMDMwMTU5NDU2fQ.3jFPGpOEPwDhAT9fFU_VXZlqGvDOPBx0RHywFnJZ6PA')
      ],
      'application/json',
      '{"action": "send_daily_email", "manual": false}'
    )::http_request);
  $$
);

-- Step 3: Verify the new schedule
SELECT 
  jobid,
  jobname, 
  schedule, 
  active,
  database,
  '10:00 UTC = 5:00 AM EST / 6:00 AM EDT' as description
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- Step 4: Check recent execution history
SELECT 
  jobid,
  runid,
  status,
  return_message,
  start_time AT TIME ZONE 'America/New_York' as start_time_et,
  end_time AT TIME ZONE 'America/New_York' as end_time_et
FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-job')
ORDER BY start_time DESC 
LIMIT 5;

-- =====================================================
-- ALTERNATIVE: TRUE 5:00 AM ET YEAR-ROUND
-- =====================================================
-- If you want 5:00 AM ET during daylight saving too,
-- uncomment this section and comment out the above:
/*
DO $$
BEGIN
  PERFORM cron.unschedule('daily-agenda-email-job');
END $$;

SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 9 * * *',  -- 9:00 UTC = 4:00 AM EST / 5:00 AM EDT
  $$
  SELECT 
    status,
    content::json->>'message' as result
  FROM 
    http((
      'POST',
      'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid3RmaW1uYm12Ymdlc2lkYnhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNDU4MzQ1NiwiZXhwIjoyMDMwMTU5NDU2fQ.3jFPGpOEPwDhAT9fFU_VXZlqGvDOPBx0RHywFnJZ6PA')
      ],
      'application/json',
      '{"action": "send_daily_email", "manual": false}'
    )::http_request);
  $$
);
*/

-- =====================================================
-- TIMEZONE REFERENCE:
-- =====================================================
-- Standard Time (Nov-Mar):
--   - 09:00 UTC = 4:00 AM EST
--   - 10:00 UTC = 5:00 AM EST ⭐ RECOMMENDED
--   - 11:00 UTC = 6:00 AM EST
--   - 12:00 UTC = 7:00 AM EST
--
-- Daylight Saving (Mar-Nov):
--   - 09:00 UTC = 5:00 AM EDT ⭐ TRUE 5AM YEAR-ROUND
--   - 10:00 UTC = 6:00 AM EDT
--   - 11:00 UTC = 7:00 AM EDT
--   - 12:00 UTC = 8:00 AM EDT
-- =====================================================

-- =====================================================
-- TESTING THE SCHEDULE:
-- =====================================================
-- To test immediately without waiting for the schedule:
-- Run this in SQL Editor:
/*
SELECT 
  status,
  content::json->>'message' as result
FROM 
  http((
    'POST',
    'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid3RmaW1uYm12Ymdlc2lkYnhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNDU4MzQ1NiwiZXhwIjoyMDMwMTU5NDU2fQ.3jFPGpOEPwDhAT9fFU_VXZlqGvDOPBx0RHywFnJZ6PA')
    ],
    'application/json',
    '{"action": "send_daily_email", "manual": false}'
  )::http_request);
*/
-- =====================================================
