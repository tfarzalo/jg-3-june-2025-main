-- =====================================================
-- FIX: Daily Agenda Email Cron Job
-- =====================================================
-- This migration fixes the cron job to actually call 
-- the Edge Function instead of just checking settings
-- =====================================================

-- Step 1: Remove the old cron job
DO $$
BEGIN
  PERFORM cron.unschedule('daily-agenda-email-job');
  RAISE NOTICE 'Removed old cron job';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'No existing cron job to remove';
END $$;

-- Step 2: Enable http extension (required for making HTTP requests)
CREATE EXTENSION IF NOT EXISTS http;

-- Step 3: Get your project URL and service role key
-- IMPORTANT: You need to replace YOUR_PROJECT_REF with your actual Supabase project reference
-- Find it in: Supabase Dashboard → Settings → API → Project URL
-- Example: https://YOUR_PROJECT_REF.supabase.co

-- Step 4: Create the new cron job that calls the Edge Function
-- This runs every day at 7:00 AM ET / 4:00 AM PT (12:00 UTC)
SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 12 * * *',  -- 7:00 AM ET / 4:00 AM PT = 12:00 UTC (noon)
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

-- Step 5: Verify the cron job was created
SELECT 
  jobid,
  jobname, 
  schedule, 
  active,
  database
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- Step 6: Test the cron job manually (optional)
-- Uncomment to test immediately:
-- SELECT 
--   status,
--   content::json->>'message' as result
-- FROM 
--   http((
--     'POST',
--     'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
--     ARRAY[
--       http_header('Content-Type', 'application/json'),
--       http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid3RmaW1uYm12Ymdlc2lkYnhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNDU4MzQ1NiwiZXhwIjoyMDMwMTU5NDU2fQ.3jFPGpOEPwDhAT9fFU_VXZlqGvDOPBx0RHywFnJZ6PA')
--     ],
--     'application/json',
--     '{"action": "send_daily_email", "manual": false}'
--   )::http_request);

-- Expected successful response:
-- status | result
-- -------+------------------------------------------
--    200 | Daily agenda emails sent successfully

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. The cron job now runs at 7:00 AM ET / 4:00 AM PT (12:00 UTC)
-- 2. It directly calls the Edge Function via HTTP POST
-- 3. The Edge Function will check daily_email_settings to see who should receive emails
-- 4. You can monitor executions with:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- 5. To change the schedule:
--    SELECT cron.unschedule('daily-agenda-email-job');
--    Then run the cron.schedule command again with a new schedule
-- =====================================================

-- COMMON SCHEDULES:
-- '0 12 * * *'        -- Daily at 7:00 AM ET / 4:00 AM PT (12:00 UTC) ⭐ CURRENT
-- '0 13 * * *'        -- Daily at 8:00 AM ET / 5:00 AM PT (13:00 UTC)
-- '0 14 * * *'        -- Daily at 9:00 AM ET / 6:00 AM PT (14:00 UTC)
-- '0 12 * * 1-5'      -- Weekdays only at 7:00 AM ET / 4:00 AM PT
-- '0 13 * * 1-5'      -- Weekdays only at 8:00 AM ET / 5:00 AM PT
-- '*/5 * * * *'       -- Every 5 minutes (for testing only!)
-- =====================================================
