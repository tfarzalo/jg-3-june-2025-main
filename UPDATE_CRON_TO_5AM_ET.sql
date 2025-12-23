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
-- We'll use 10:00 UTC as the standard time.

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
-- ⚠️ REPLACE [YOUR_PROJECT_REF] and [YOUR_SERVICE_ROLE_KEY] BEFORE RUNNING ⚠️
SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 10 * * *',
  $$
  SELECT 
    status,
    content::json->>'message' as result
  FROM 
    http((
      'POST',
      'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-daily-agenda-email',
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer [YOUR_SERVICE_ROLE_KEY]')
      ],
      'application/json',
      '{"mode": "all"}'
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
